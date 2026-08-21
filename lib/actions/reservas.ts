"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getResend, REMITENTE } from "@/lib/resend";
import { emailConfirmacionReserva, emailListaEspera } from "@/lib/emails";

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

// El email de confirmacion nunca debe tumbar la reserva: si Resend falla
// (o si la clienta importada del Excel todavia tiene un email placeholder,
// que rebotara hasta que se le ponga el real) la reserva ya quedo hecha en
// la base de datos, asi que el error se traga y solo se registra.
async function enviarEmailReserva(sesionId: string, clienteId: string, estado: string) {
  try {
    const supabase = await createClient();
    const { data: sesion } = await supabase.from("sesiones").select("fecha, clase_id").eq("id", sesionId).single();
    if (!sesion) return;
    const { data: clase } = await supabase.from("clases").select("hora_inicio, hora_fin").eq("id", sesion.clase_id).single();
    if (!clase) return;
    const { data: cliente } = await supabase.from("clientes").select("usuario_id").eq("id", clienteId).single();
    if (!cliente) return;
    const { data: usuario } = await supabase.from("users").select("nombre, email").eq("id", cliente.usuario_id).single();
    if (!usuario) return;

    const datos = {
      nombreCliente: usuario.nombre,
      fecha: sesion.fecha,
      horaInicio: clase.hora_inicio.slice(0, 5),
      horaFin: clase.hora_fin.slice(0, 5),
    };
    const { subject, html } = estado === "lista_espera" ? emailListaEspera(datos) : emailConfirmacionReserva(datos);
    await getResend().emails.send({ from: REMITENTE, to: usuario.email, subject, html });
  } catch (e) {
    console.error("No se pudo enviar el email de reserva:", e);
  }
}

export async function reservarSesion(sesionId: string, clienteId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reservar_sesion", { p_sesion_id: sesionId, p_cliente_id: clienteId });
  if (error) return { error: traducirError(error.message) };

  // Esperado (no en segundo plano): en serverless, la funcion puede
  // congelarse en cuanto la accion "termina" y un envio sin esperar podria
  // no llegar a completarse nunca. El try/catch de dentro evita que un
  // fallo de Resend le devuelva un error a la clienta por algo que ya
  // funciono (la reserva).
  if (data) await enviarEmailReserva(sesionId, clienteId, data.estado);

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
