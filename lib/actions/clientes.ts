"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteFormSchema } from "@/lib/validaciones";

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
  if (errorUsers) return { error: errorUsers.message };

  const { data: cliente, error: errorCliente } = await supabase
    .from("clientes")
    .insert({ usuario_id: nuevoAuthUser.user.id, plan_id: planId, notas_rutina: notasRutina })
    .select()
    .single();
  if (errorCliente || !cliente) return { error: errorCliente?.message ?? "No se pudo crear la clienta" };

  const { data: plan } = await supabase.from("planes").select("*").eq("id", planId).single();
  if (plan) {
    const fechaHoy = new Date().toISOString().slice(0, 10);
    await supabase.from("pagos").insert({
      cliente_id: cliente.id,
      plan_id: plan.id,
      tipo: plan.tipo,
      metodo: plan.tipo === "mensual" ? "stripe" : "efectivo",
      estado: "pendiente",
      importe: plan.precio,
      fecha_pago: fechaHoy,
      registrado_por: admin.id,
    });

    if (plan.tipo === "bono") {
      await supabase.from("bonos_cliente").insert({
        cliente_id: cliente.id,
        plan_id: plan.id,
        creditos_totales: plan.clases_incluidas ?? 0,
        creditos_usados: 0,
        fecha_compra: fechaHoy,
        activo: true,
      });
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
  const { error } = await supabase.from("clientes").update({ estado: "baja" }).eq("id", clienteId);
  if (error) return { error: error.message };
  revalidatePath("/admin/clientes");
  revalidatePath("/entrenador/clientes");
  return {};
}

export async function reactivarCliente(clienteId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update({ estado: "activo" }).eq("id", clienteId);
  if (error) return { error: error.message };
  revalidatePath("/admin/clientes");
  revalidatePath("/entrenador/clientes");
  return {};
}

export async function actualizarCliente(
  clienteId: string,
  datos: { planId: string; notasRutina: string }
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: clienteActual } = await supabase.from("clientes").select("plan_id").eq("id", clienteId).single();
  const cambiaPlan = Boolean(clienteActual) && datos.planId !== clienteActual!.plan_id;

  const { error } = await supabase
    .from("clientes")
    .update({ plan_id: datos.planId, notas_rutina: datos.notasRutina })
    .eq("id", clienteId);
  if (error) return { error: error.message };

  if (cambiaPlan) {
    const { data: nuevoPlan } = await supabase.from("planes").select("*").eq("id", datos.planId).single();
    if (nuevoPlan) {
      const { data: pagoExistente } = await supabase
        .from("pagos")
        .select("id")
        .eq("cliente_id", clienteId)
        .limit(1)
        .maybeSingle();
      if (pagoExistente) {
        await supabase
          .from("pagos")
          .update({ plan_id: nuevoPlan.id, tipo: nuevoPlan.tipo, importe: nuevoPlan.precio })
          .eq("id", pagoExistente.id);
      }

      const { data: bonoActivo } = await supabase
        .from("bonos_cliente")
        .select("id")
        .eq("cliente_id", clienteId)
        .eq("activo", true)
        .maybeSingle();

      if (nuevoPlan.tipo === "bono" && !bonoActivo) {
        await supabase.from("bonos_cliente").insert({
          cliente_id: clienteId,
          plan_id: nuevoPlan.id,
          creditos_totales: nuevoPlan.clases_incluidas ?? 0,
          creditos_usados: 0,
          fecha_compra: new Date().toISOString().slice(0, 10),
          activo: true,
        });
      } else if (nuevoPlan.tipo === "mensual" && bonoActivo) {
        await supabase.from("bonos_cliente").update({ activo: false }).eq("id", bonoActivo.id);
      }
    }
  }

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/cobros");
  revalidatePath("/entrenador/clientes");
  revalidatePath("/entrenador/cobros");
  return {};
}
