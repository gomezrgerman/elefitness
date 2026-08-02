"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const registrarPagoSchema = z.object({
  pagoId: z.string().min(1),
  fechaPago: z.string().min(1),
  proximoCobro: z.string().nullable(),
});

export async function registrarPago(datos: unknown): Promise<{ error?: string }> {
  const resultado = registrarPagoSchema.safeParse(datos);
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { pagoId, fechaPago, proximoCobro } = resultado.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("pagos")
    .update({ estado: "al_dia", ultimo_cobro: fechaPago, proximo_cobro: proximoCobro, fecha_pago: fechaPago })
    .eq("id", pagoId);
  if (error) return { error: error.message };

  revalidatePath("/admin/cobros");
  revalidatePath("/entrenador/cobros");
  return {};
}
