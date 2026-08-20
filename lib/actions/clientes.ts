"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/lib/database.types";
import { clienteFormSchema } from "@/lib/validaciones";
import { hoyEnEspana } from "@/lib/fechas";

const actualizarClienteSchema = z
  .object({
    planId: z.string().nullable(),
    importe: z.coerce.number().positive("El importe debe ser mayor que 0").optional(),
    metodo: z.enum(["stripe", "efectivo", "transferencia"]).optional(),
    notasRutina: z.string().max(2000),
    diasSemanaHabituales: z.coerce
      .number()
      .int("Los dias por semana deben ser un numero entero")
      .min(1, "Minimo 1 dia por semana")
      .max(7, "Maximo 7 dias por semana"),
    entrenadorRestringidoId: z.string().uuid("Entrenador invalido").nullable(),
  })
  .superRefine((datos, ctx) => {
    if (!datos.planId) return;
    if (datos.importe === undefined) {
      ctx.addIssue({ path: ["importe"], code: z.ZodIssueCode.custom, message: "El importe debe ser mayor que 0" });
    }
    if (datos.metodo === undefined) {
      ctx.addIssue({ path: ["metodo"], code: z.ZodIssueCode.custom, message: "Selecciona un metodo de pago" });
    }
  });

export async function altaCliente(datos: unknown): Promise<{ error?: string }> {
  const resultado = clienteFormSchema.safeParse(datos);
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { nombre, email, telefono, planId, importe, metodo, notasRutina, diasSemanaHabituales, entrenadorRestringidoId } = resultado.data;

  const supabase = await createClient();
  const {
    data: { user: admin },
  } = await supabase.auth.getUser();
  if (!admin) return { error: "No autenticado" };

  const { data: perfilAdmin } = await supabase.from("users").select("rol").eq("id", admin.id).single();
  if (perfilAdmin?.rol !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();
  const { data: nuevoAuthUser, error: errorAuth } = await adminClient.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
  });
  if (errorAuth || !nuevoAuthUser.user) {
    return { error: errorAuth?.message ?? "No se pudo crear la cuenta de la clienta" };
  }

  const { error: errorUsers } = await supabase.from("users").insert({
    id: nuevoAuthUser.user.id,
    email,
    rol: "cliente",
    nombre,
    telefono,
  });
  if (errorUsers) {
    await adminClient.auth.admin.deleteUser(nuevoAuthUser.user.id);
    return { error: errorUsers.message };
  }

  // Sin plan = clienta "en el aire" (temporada, horario muy variable) que
  // Elena quiere tener a mano sin cobro activo: se da de alta directamente
  // de baja, sin fila de pago ni bono, hasta que vuelva y se le asigne plan.
  const { data: cliente, error: errorCliente } = await supabase
    .from("clientes")
    .insert({
      usuario_id: nuevoAuthUser.user.id,
      plan_id: planId,
      estado: planId ? "activo" : "baja",
      notas_rutina: notasRutina,
      dias_semana_habituales: diasSemanaHabituales,
      entrenador_restringido_id: entrenadorRestringidoId,
    })
    .select()
    .single();
  if (errorCliente || !cliente) {
    await adminClient.auth.admin.deleteUser(nuevoAuthUser.user.id);
    return { error: errorCliente?.message ?? "No se pudo crear la clienta" };
  }

  if (planId) {
    // El schema garantiza importe/metodo definidos cuando hay planId (ver
    // superRefine en clienteFormSchema); esta comprobacion es solo para que
    // TypeScript lo sepa tambien.
    if (importe === undefined || metodo === undefined) {
      await supabase.from("clientes").delete().eq("id", cliente.id);
      await adminClient.auth.admin.deleteUser(nuevoAuthUser.user.id);
      return { error: "Falta el importe o el metodo de pago" };
    }

    const { data: plan, error: errorPlan } = await supabase.from("planes").select("*").eq("id", planId).single();
    if (errorPlan || !plan) {
      await supabase.from("clientes").delete().eq("id", cliente.id);
      await adminClient.auth.admin.deleteUser(nuevoAuthUser.user.id);
      return { error: errorPlan?.message ?? "No se pudo encontrar el plan" };
    }

    const fechaHoy = hoyEnEspana();
    const { error: errorPago } = await supabase.from("pagos").insert({
      cliente_id: cliente.id,
      plan_id: plan.id,
      tipo: plan.tipo,
      metodo,
      estado: "pendiente",
      importe,
      fecha_pago: fechaHoy,
      registrado_por: admin.id,
    });
    if (errorPago) {
      await supabase.from("clientes").delete().eq("id", cliente.id);
      await adminClient.auth.admin.deleteUser(nuevoAuthUser.user.id);
      return { error: errorPago.message };
    }

    if (plan.tipo === "bono") {
      const { error: errorBono } = await supabase.rpc("crear_bono", {
        p_cliente_id: cliente.id,
        p_plan_id: plan.id,
        p_creditos_totales: plan.clases_incluidas ?? 0,
        p_fecha_compra: fechaHoy,
        p_tipo: "normal",
      });
      if (errorBono) {
        await supabase.from("clientes").delete().eq("id", cliente.id);
        await adminClient.auth.admin.deleteUser(nuevoAuthUser.user.id);
        return { error: errorBono.message };
      }
    }
  }

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/cobros");
  revalidatePath("/entrenador/clientes");
  revalidatePath("/entrenador/cobros");
  return {};
}

export async function bajaCliente(clienteId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clientes").update({ estado: "baja" }).eq("id", clienteId).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "No autorizado" };
  revalidatePath("/admin/clientes");
  revalidatePath("/entrenador/clientes");
  return {};
}

export async function reactivarCliente(clienteId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clientes").update({ estado: "activo" }).eq("id", clienteId).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "No autorizado" };
  revalidatePath("/admin/clientes");
  revalidatePath("/entrenador/clientes");
  return {};
}

export async function actualizarCliente(
  clienteId: string,
  datos: {
    planId: string | null;
    importe?: number;
    metodo?: string;
    notasRutina: string;
    diasSemanaHabituales: number;
    entrenadorRestringidoId: string | null;
  }
): Promise<{ error?: string }> {
  const resultado = actualizarClienteSchema.safeParse(datos);
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const supabase = await createClient();

  const { data: clienteActual } = await supabase.from("clientes").select("plan_id").eq("id", clienteId).single();
  const nuevoPlanId = resultado.data.planId;
  const cambiaPlan = Boolean(clienteActual) && nuevoPlanId !== (clienteActual!.plan_id ?? null);

  const { data: clienteActualizado, error } = await supabase
    .from("clientes")
    .update({
      plan_id: nuevoPlanId,
      notas_rutina: resultado.data.notasRutina,
      dias_semana_habituales: resultado.data.diasSemanaHabituales,
      entrenador_restringido_id: resultado.data.entrenadorRestringidoId,
    })
    .eq("id", clienteId)
    .select();
  if (error) return { error: error.message };
  if (!clienteActualizado || clienteActualizado.length === 0) return { error: "No autorizado" };

  // Sin plan nuevo (se deja "en el aire") no hay pago que sincronizar ni
  // crear: el registro de pago anterior, si lo tenia, se deja tal cual como
  // historico hasta que vuelva a asignarsele un plan.
  if (nuevoPlanId) {
    // El schema garantiza importe/metodo definidos cuando hay planId (ver
    // superRefine en actualizarClienteSchema); esta comprobacion es solo
    // para que TypeScript lo sepa tambien.
    if (resultado.data.importe === undefined || resultado.data.metodo === undefined) {
      return { error: "Falta el importe o el metodo de pago" };
    }

    const { data: pagoExistente } = await supabase
      .from("pagos")
      .select("id")
      .eq("cliente_id", clienteId)
      .limit(1)
      .maybeSingle();

    const { data: nuevoPlanPago, error: errorNuevoPlanPago } = await supabase
      .from("planes")
      .select("id, tipo")
      .eq("id", nuevoPlanId)
      .single();
    if (errorNuevoPlanPago || !nuevoPlanPago) return { error: errorNuevoPlanPago?.message ?? "No se pudo encontrar el nuevo plan" };

    if (pagoExistente) {
      // El importe y el metodo se sincronizan siempre, cambie o no el plan:
      // es el mismo sitio donde Elena corrige una cuota personalizada o un
      // pago parcial, sin tener que cambiar de plan para poder tocarlos.
      const cambiosPago: TablesUpdate<"pagos"> = {
        importe: resultado.data.importe,
        metodo: resultado.data.metodo,
      };
      if (cambiaPlan) {
        cambiosPago.plan_id = nuevoPlanPago.id;
        cambiosPago.tipo = nuevoPlanPago.tipo;
      }
      const { error: errorActualizarPago } = await supabase.from("pagos").update(cambiosPago).eq("id", pagoExistente.id);
      if (errorActualizarPago) return { error: errorActualizarPago.message };
    } else {
      // Antes no tenia plan (ni pago), se le acaba de asignar uno.
      const { error: errorCrearPago } = await supabase.from("pagos").insert({
        cliente_id: clienteId,
        plan_id: nuevoPlanPago.id,
        tipo: nuevoPlanPago.tipo,
        metodo: resultado.data.metodo,
        estado: "pendiente",
        importe: resultado.data.importe,
        fecha_pago: hoyEnEspana(),
        registrado_por: (await supabase.auth.getUser()).data.user?.id ?? "",
      });
      if (errorCrearPago) return { error: errorCrearPago.message };
    }
  }

  if (cambiaPlan && nuevoPlanId) {
    const { data: nuevoPlan, error: errorNuevoPlan } = await supabase.from("planes").select("*").eq("id", nuevoPlanId).single();
    if (errorNuevoPlan || !nuevoPlan) return { error: errorNuevoPlan?.message ?? "No se pudo encontrar el nuevo plan" };

    const { data: bonoActivo } = await supabase
      .from("bonos_cliente")
      .select("id")
      .eq("cliente_id", clienteId)
      .eq("activo", true)
      .maybeSingle();

    if (nuevoPlan.tipo === "bono" && !bonoActivo) {
      const { error: errorInsertBono } = await supabase.rpc("crear_bono", {
        p_cliente_id: clienteId,
        p_plan_id: nuevoPlan.id,
        p_creditos_totales: nuevoPlan.clases_incluidas ?? 0,
        p_fecha_compra: hoyEnEspana(),
        p_tipo: "normal",
      });
      if (errorInsertBono) return { error: errorInsertBono.message };
    } else if (nuevoPlan.tipo === "mensual" && bonoActivo) {
      const { error: errorDesactivarBono } = await supabase.from("bonos_cliente").update({ activo: false }).eq("id", bonoActivo.id);
      if (errorDesactivarBono) return { error: errorDesactivarBono.message };
    }
  }

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/cobros");
  revalidatePath("/entrenador/clientes");
  revalidatePath("/entrenador/cobros");
  return {};
}
