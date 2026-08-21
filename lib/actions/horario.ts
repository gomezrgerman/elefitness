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
// como fijo, deja a la clienta reservandose sola cada semana a partir de
// ahora (solo mensualidades, ver migracion 0022).
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
  return { sesionesMovidas: data ?? 0 };
}

const idSchema = z.string().uuid("Identificador invalido");

// Quitar del horario fijo (vista "Horario fijo" por franja): solo desasigna
// clase_habitual_id, no toca ninguna reserva ya existente. Si Elena tambien
// quiere cancelar sus sesiones futuras de esa clase, lo hace aparte desde la
// vista de dia -- no se asume automaticamente, para no cancelar de golpe
// algo que la clienta seguia esperando encontrarse esta semana.
export async function quitarHorarioFijo(clienteId: string): Promise<{ error?: string }> {
  const resultado = idSchema.safeParse(clienteId);
  if (!resultado.success) return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .update({ clase_habitual_id: null })
    .eq("id", resultado.data)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "No autorizado" };

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/clases");
  return {};
}
