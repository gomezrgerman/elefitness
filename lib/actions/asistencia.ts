"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { EstadoAsistencia } from "@/lib/types";

export async function marcarAsistencia(
  reservaId: string,
  asistencia: EstadoAsistencia
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_asistencia", {
    p_reserva_id: reservaId,
    p_asistencia: asistencia,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/clases");
  revalidatePath("/entrenador/clases");
  revalidatePath("/admin/clientes");
  revalidatePath("/entrenador/clientes");
  return {};
}
