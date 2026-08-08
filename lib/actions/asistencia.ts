"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function marcarAsistencia(reservaId: string, asistio: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_asistencia", { p_reserva_id: reservaId, p_asistio: asistio });
  if (error) return { error: error.message };

  revalidatePath("/admin/clases");
  revalidatePath("/entrenador/clases");
  return {};
}
