"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearBono(
  clienteId: string,
  planId: string,
  creditosTotales: number,
  fechaCompra: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_bono", {
    p_cliente_id: clienteId,
    p_plan_id: planId,
    p_creditos_totales: creditosTotales,
    p_fecha_compra: fechaCompra,
    p_tipo: "normal",
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/cobros");
  revalidatePath("/entrenador/clientes");
  revalidatePath("/entrenador/cobros");
  return {};
}
