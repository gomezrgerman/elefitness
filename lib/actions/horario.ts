"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const moverHorarioSchema = z.object({
  clienteId: z.string().uuid("Cliente invalido"),
  claseOrigenId: z.string().uuid("Clase invalida").nullable(),
  claseDestinoId: z.string().uuid("Selecciona el horario nuevo"),
  desde: z.string().regex(FECHA_REGEX, "Fecha invalida"),
  marcarFijo: z.boolean(),
});

// Movimiento de horario hecho por Elena: mueve las reservas futuras ya
// existentes del horario viejo al nuevo sin penalizar (se devuelve credito
// de bono si aplica, nunca se emite bono de recuperacion) y, si se marca
// como fijo, AÑADE ese horario al conjunto de horarios fijos de la clienta
// (puede tener varios a la vez, ver migracion 0023) -- reservandose sola
// cada semana a partir de ahora (solo mensualidades).
export async function moverHorarioCliente(datos: unknown): Promise<{ error?: string; sesionesMovidas?: number }> {
  const resultado = moverHorarioSchema.safeParse(datos);
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { clienteId, claseOrigenId, claseDestinoId, desde, marcarFijo } = resultado.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mover_horario_cliente", {
    p_cliente_id: clienteId,
    p_clase_origen_id: claseOrigenId,
    p_clase_destino_id: claseDestinoId,
    p_desde: desde,
    p_marcar_fijo: marcarFijo,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/clases");
  revalidatePath("/cliente");
  return { sesionesMovidas: data ?? 0 };
}

const quitarHorarioFijoSchema = z.object({
  clienteId: z.string().uuid("Cliente invalido"),
  claseId: z.string().uuid("Clase invalida"),
});

// Quitar UNA franja del conjunto de horarios fijos (puede tener varias):
// solo borra esa fila de clientes_horario_fijo, no toca ninguna reserva ya
// existente. Si Elena tambien quiere cancelar sus sesiones futuras de esa
// clase, lo hace aparte desde la vista de dia -- no se asume
// automaticamente, para no cancelar de golpe algo que la clienta seguia
// esperando encontrarse esta semana.
export async function quitarHorarioFijo(clienteId: string, claseId: string): Promise<{ error?: string }> {
  const resultado = quitarHorarioFijoSchema.safeParse({ clienteId, claseId });
  if (!resultado.success) return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes_horario_fijo")
    .delete()
    .eq("cliente_id", resultado.data.clienteId)
    .eq("clase_id", resultado.data.claseId)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "No autorizado" };

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/clases");
  revalidatePath("/cliente");
  return {};
}
