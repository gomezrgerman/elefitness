"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/lib/database.types";

const registrarPagoSchema = z.object({
  pagoId: z.string().min(1),
  fechaPago: z.string().min(1),
  proximoCobro: z.string().nullable(),
  // Opcional: por defecto se cobra el importe que ya tenia el pago (el de su
  // plan o el que se le fijo a mano). Se manda distinto cuando Elena registra
  // un pago parcial puntual ("me ha pagado 80 de los 90") -- el numero que
  // entre aqui se queda como el importe esperado del ciclo siguiente tambien,
  // porque `pagos` es una fila que se reutiliza, no un historial por cobro.
  importe: z.coerce.number().positive("El importe debe ser mayor que 0").optional(),
});

export async function registrarPago(datos: unknown): Promise<{ error?: string }> {
  const resultado = registrarPagoSchema.safeParse(datos);
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { pagoId, fechaPago, proximoCobro, importe } = resultado.data;

  const supabase = await createClient();
  const cambios: TablesUpdate<"pagos"> = {
    estado: "al_dia",
    ultimo_cobro: fechaPago,
    proximo_cobro: proximoCobro,
    fecha_pago: fechaPago,
  };
  if (importe !== undefined) cambios.importe = importe;
  const { data, error } = await supabase.from("pagos").update(cambios).eq("id", pagoId).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "No autorizado" };

  revalidatePath("/admin/cobros");
  revalidatePath("/entrenador/cobros");
  return {};
}
