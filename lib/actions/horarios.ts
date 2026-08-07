"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function copiarSemana(fechaOrigen: string, fechaDestino: string): Promise<{ creadas?: number; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copiar_semana", {
    p_fecha_origen: fechaOrigen,
    p_fecha_destino: fechaDestino,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/clases");
  revalidatePath("/entrenador/clases");
  revalidatePath("/cliente");
  return { creadas: data ?? 0 };
}
