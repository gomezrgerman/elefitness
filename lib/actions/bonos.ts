"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const crearBonoSchema = z.object({
  clienteId: z.string().uuid("Cliente invalido"),
  planId: z.string().uuid("Plan invalido"),
  creditosTotales: z.number().int("Los creditos deben ser un numero entero").min(1, "El bono debe tener al menos 1 credito"),
  fechaCompra: z.string().regex(FECHA_REGEX, "Fecha de compra invalida"),
  // Sin fecha, crear_bono calcula ella sola +3 meses: Elena solo la pasa
  // cuando quiere fijarla a mano, como hacia en Harbiz.
  fechaCaducidad: z.string().regex(FECHA_REGEX, "Fecha de caducidad invalida").nullable().optional(),
});

export async function crearBono(datos: unknown): Promise<{ error?: string }> {
  const resultado = crearBonoSchema.safeParse(datos);
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { clienteId, planId, creditosTotales, fechaCompra, fechaCaducidad } = resultado.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_bono", {
    p_cliente_id: clienteId,
    p_plan_id: planId,
    p_creditos_totales: creditosTotales,
    p_fecha_compra: fechaCompra,
    p_tipo: "normal",
    p_fecha_caducidad: fechaCaducidad ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/cobros");
  revalidatePath("/entrenador/clientes");
  revalidatePath("/entrenador/cobros");
  return {};
}

const idSchema = z.string().uuid("Identificador invalido");

// Dos remedios manuales e independientes que Elena pidio para una sesion que
// ya descarto un credito de bono (reservas.bono_id): "devolver el credito"
// deshace ese descuento puntual; "anadir sesion extra" compensa por encima
// sin tocar el descuento original. No comparten guarda de negocio mas alla
// del rol -- se apoyan en bonos_admin_all (RLS), igual que ajustarAforoSesion.
export async function devolverCreditoSesion(reservaId: string): Promise<{ error?: string }> {
  const resultado = idSchema.safeParse(reservaId);
  if (!resultado.success) return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };

  const supabase = await createClient();
  const { data: reserva, error: errorReserva } = await supabase
    .from("reservas")
    .select("bono_id")
    .eq("id", resultado.data)
    .maybeSingle();
  if (errorReserva) return { error: errorReserva.message };
  if (!reserva?.bono_id) return { error: "Esta reserva no desconto ningun credito de bono" };

  const { data: bono, error: errorBono } = await supabase
    .from("bonos_cliente")
    .select("creditos_usados")
    .eq("id", reserva.bono_id)
    .maybeSingle();
  if (errorBono) return { error: errorBono.message };
  if (!bono) return { error: "No autorizado" };

  const { data: actualizado, error } = await supabase
    .from("bonos_cliente")
    .update({ creditos_usados: Math.max(0, bono.creditos_usados - 1) })
    .eq("id", reserva.bono_id)
    .select();
  if (error) return { error: error.message };
  if (!actualizado || actualizado.length === 0) return { error: "No autorizado" };

  revalidatePath("/admin/clientes");
  return {};
}

export async function anadirSesionExtraBono(bonoId: string): Promise<{ error?: string }> {
  const resultado = idSchema.safeParse(bonoId);
  if (!resultado.success) return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };

  const supabase = await createClient();
  const { data: bono, error: errorBono } = await supabase
    .from("bonos_cliente")
    .select("creditos_totales")
    .eq("id", resultado.data)
    .maybeSingle();
  if (errorBono) return { error: errorBono.message };
  if (!bono) return { error: "No autorizado" };

  const { data: actualizado, error } = await supabase
    .from("bonos_cliente")
    .update({ creditos_totales: bono.creditos_totales + 1 })
    .eq("id", resultado.data)
    .select();
  if (error) return { error: error.message };
  if (!actualizado || actualizado.length === 0) return { error: "No autorizado" };

  revalidatePath("/admin/clientes");
  return {};
}
