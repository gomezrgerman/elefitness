"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function traducirError(mensaje: string): string {
  if (mensaje.includes("ya ha pasado")) return "Esta sesión ya ha pasado";
  if (mensaje.includes("asistencia ya registrada")) return "No se puede cancelar una sesión con la asistencia ya registrada";
  if (mensaje.includes("creditos de bono")) return "No quedan créditos de bono disponibles";
  if (mensaje.includes("reserva activa")) return "Ya tienes una reserva activa para esta sesión";
  if (mensaje.includes("ventana de reserva")) return "Esta clase está fuera de tu ventana de reserva de 3 semanas";
  if (mensaje.includes("no encontrad")) return "No se ha encontrado la sesión o la reserva";
  if (mensaje.includes("cancelada")) return "Esa reserva ya estaba cancelada";
  if (mensaje.includes("dada de baja")) return "Esta clienta esta dada de baja";
  if (mensaje.includes("No autorizado")) return "No tienes permiso para hacer esta acción";
  return "No se pudo completar la reserva";
}

export async function reservarSesion(sesionId: string, clienteId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reservar_sesion", { p_sesion_id: sesionId, p_cliente_id: clienteId });
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
