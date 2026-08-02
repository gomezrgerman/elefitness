"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteFormSchema } from "@/lib/validaciones";

const actualizarClienteSchema = z.object({
  planId: z.string().min(1),
  notasRutina: z.string().max(2000),
});

export async function altaCliente(datos: unknown): Promise<{ error?: string }> {
  const resultado = clienteFormSchema.safeParse(datos);
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { nombre, email, telefono, planId, notasRutina } = resultado.data;

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

  const { data: cliente, error: errorCliente } = await supabase
    .from("clientes")
    .insert({ usuario_id: nuevoAuthUser.user.id, plan_id: planId, notas_rutina: notasRutina })
    .select()
    .single();
  if (errorCliente || !cliente) {
    await adminClient.auth.admin.deleteUser(nuevoAuthUser.user.id);
    return { error: errorCliente?.message ?? "No se pudo crear la clienta" };
  }

  const { data: plan, error: errorPlan } = await supabase.from("planes").select("*").eq("id", planId).single();
  if (errorPlan || !plan) {
    await supabase.from("clientes").delete().eq("id", cliente.id);
    await adminClient.auth.admin.deleteUser(nuevoAuthUser.user.id);
    return { error: errorPlan?.message ?? "No se pudo encontrar el plan" };
  }

  const fechaHoy = new Date().toISOString().slice(0, 10);
  const { error: errorPago } = await supabase.from("pagos").insert({
    cliente_id: cliente.id,
    plan_id: plan.id,
    tipo: plan.tipo,
    metodo: plan.tipo === "mensual" ? "stripe" : "efectivo",
    estado: "pendiente",
    importe: plan.precio,
    fecha_pago: fechaHoy,
    registrado_por: admin.id,
  });
  if (errorPago) {
    await supabase.from("clientes").delete().eq("id", cliente.id);
    await adminClient.auth.admin.deleteUser(nuevoAuthUser.user.id);
    return { error: errorPago.message };
  }

  if (plan.tipo === "bono") {
    const { error: errorBono } = await supabase.from("bonos_cliente").insert({
      cliente_id: cliente.id,
      plan_id: plan.id,
      creditos_totales: plan.clases_incluidas ?? 0,
      creditos_usados: 0,
      fecha_compra: fechaHoy,
      activo: true,
    });
    if (errorBono) {
      await supabase.from("clientes").delete().eq("id", cliente.id);
      await adminClient.auth.admin.deleteUser(nuevoAuthUser.user.id);
      return { error: errorBono.message };
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
  datos: { planId: string; notasRutina: string }
): Promise<{ error?: string }> {
  const resultado = actualizarClienteSchema.safeParse(datos);
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const supabase = await createClient();

  const { data: clienteActual } = await supabase.from("clientes").select("plan_id").eq("id", clienteId).single();
  const cambiaPlan = Boolean(clienteActual) && datos.planId !== clienteActual!.plan_id;

  const { data: clienteActualizado, error } = await supabase
    .from("clientes")
    .update({ plan_id: datos.planId, notas_rutina: datos.notasRutina })
    .eq("id", clienteId)
    .select();
  if (error) return { error: error.message };
  if (!clienteActualizado || clienteActualizado.length === 0) return { error: "No autorizado" };

  if (cambiaPlan) {
    const { data: nuevoPlan, error: errorNuevoPlan } = await supabase.from("planes").select("*").eq("id", datos.planId).single();
    if (errorNuevoPlan || !nuevoPlan) return { error: errorNuevoPlan?.message ?? "No se pudo encontrar el nuevo plan" };

    const { data: pagoExistente } = await supabase
      .from("pagos")
      .select("id")
      .eq("cliente_id", clienteId)
      .limit(1)
      .maybeSingle();
    if (pagoExistente) {
      const { error: errorActualizarPago } = await supabase
        .from("pagos")
        .update({ plan_id: nuevoPlan.id, tipo: nuevoPlan.tipo, importe: nuevoPlan.precio })
        .eq("id", pagoExistente.id);
      if (errorActualizarPago) return { error: errorActualizarPago.message };
    }

    const { data: bonoActivo } = await supabase
      .from("bonos_cliente")
      .select("id")
      .eq("cliente_id", clienteId)
      .eq("activo", true)
      .maybeSingle();

    if (nuevoPlan.tipo === "bono" && !bonoActivo) {
      const { error: errorInsertBono } = await supabase.from("bonos_cliente").insert({
        cliente_id: clienteId,
        plan_id: nuevoPlan.id,
        creditos_totales: nuevoPlan.clases_incluidas ?? 0,
        creditos_usados: 0,
        fecha_compra: new Date().toISOString().slice(0, 10),
        activo: true,
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
