"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Copia las sesiones de la semana de fechaOrigen a la de fechaDestino, que debe
// caer a un multiplo de 7 dias. Arrastra tambien las reservas de las clientas
// mensuales (horario fijo); las de bono reservan su plaza ellas mismas.
export async function copiarSemana(
  fechaOrigen: string,
  fechaDestino: string
): Promise<{ sesionesCreadas?: number; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copiar_semana", {
    p_fecha_origen: fechaOrigen,
    p_fecha_destino: fechaDestino,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/clases");
  revalidatePath("/entrenador/clases");
  revalidatePath("/cliente");
  return { sesionesCreadas: data ?? 0 };
}
