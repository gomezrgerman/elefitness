"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// aforo_efectivo es el tope oculto por sesion: permite a Elena bajar el aforo de
// un dia concreto (obras, una lesion que necesita mas espacio, refuerzo de un
// grupo) sin tocar el aforo_max de la clase-plantilla ni ensenarle el numero a
// la clienta. Hasta ahora la columna solo se podia escribir a mano en la base de
// datos. `null` quita el tope y devuelve la sesion al aforo_max de su clase.
//
// Es admin-only por RLS: la unica policy de escritura sobre `sesiones` es
// sesiones_admin_all, asi que un entrenador o una clienta reciben 0 filas
// actualizadas en vez de un error de permisos.
const ajustarAforoSchema = z.object({
  sesionId: z.string().uuid("Sesion invalida"),
  aforoEfectivo: z.number().int("El aforo debe ser un numero entero").min(0, "El aforo no puede ser negativo").nullable(),
});

export async function ajustarAforoSesion(sesionId: string, aforoEfectivo: number | null): Promise<{ error?: string }> {
  const resultado = ajustarAforoSchema.safeParse({ sesionId, aforoEfectivo });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sesiones")
    .update({ aforo_efectivo: resultado.data.aforoEfectivo })
    .eq("id", resultado.data.sesionId)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "No autorizado" };

  revalidatePath("/admin/clases");
  revalidatePath("/entrenador/clases");
  revalidatePath("/cliente");
  return {};
}
