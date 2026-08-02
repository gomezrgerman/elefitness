"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function traducirError(mensaje: string): string {
  if (mensaje.includes("creditos de bono")) return "No quedan créditos de bono disponibles";
  if (mensaje.includes("reserva activa")) return "Ya tienes una reserva activa para esta clase";
  if (mensaje.includes("no encontrad")) return "No se ha encontrado la clase o la reserva";
  if (mensaje.includes("cancelada")) return "Esa reserva ya estaba cancelada";
  if (mensaje.includes("dada de baja")) return "Esta clienta esta dada de baja";
  if (mensaje.includes("No autorizado")) return "No tienes permiso para hacer esta acción";
  return "No se pudo completar la reserva";
}

export async function reservarClase(claseId: string, clienteId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reservar_clase", { p_clase_id: claseId, p_cliente_id: clienteId });
  if (error) return { error: traducirError(error.message) };

  revalidatePath("/cliente");
  revalidatePath("/admin/clases");
  revalidatePath("/entrenador/clases");
  return {};
}

export async function cancelarReserva(reservaId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancelar_reserva", { p_reserva_id: reservaId });
  if (error) return { error: traducirError(error.message) };

  revalidatePath("/cliente");
  revalidatePath("/admin/clases");
  revalidatePath("/entrenador/clases");
  return {};
}
