"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ORDEN_DIAS } from "@/lib/selectors";
import type { DiaSemana } from "@/lib/types";

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Codigo de Postgres para una fila rechazada por row-level security (RLS). Se
// usa para no filtrar el mensaje crudo de Postgres ("new row violates
// row-level security policy...") cuando quien llama no es admin: eso es un
// detalle de implementacion, no algo que la UI deba mostrar.
const CODIGO_RLS = "42501";

// Misma aritmetica que aDate/inicioDeSemana en lib/fechas.ts (mediodia UTC
// para no arrastrar cambios de zona), pero devolviendo el dia de la semana en
// vez de una fecha desplazada. ORDEN_DIAS[0] es lunes, igual que
// getUTCDay()===1; de ahi el (+6)%7 para alinear domingo=0 de JS con
// lunes=0 de ORDEN_DIAS.
function diaSemanaDeFecha(fecha: string): DiaSemana {
  const [anyo, mes, dia] = fecha.split("-").map(Number);
  const d = new Date(Date.UTC(anyo, mes - 1, dia, 12));
  return ORDEN_DIAS[(d.getUTCDay() + 6) % 7];
}

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

// Abrir un hueco de la rejilla son dos escrituras: la clase-plantilla y la
// sesion de esa fecha concreta. `recurrente` decide si la clase queda en el
// horario fijo (se repite cada semana al copiar) o si es solo para ese dia
// (copiar_semana la ignora, ver 0015_franjas_y_sesion_abierta.sql). Si la
// segunda escritura falla hay que deshacer la primera: una clase sin sesion es
// invisible en la UI pero ya forma parte del horario fijo, y una semana
// despues copiar_semana la habria propagado sin que nadie la viera nunca.
// Mismo patron de deshacer que altaCliente en lib/actions/clientes.ts.
const abrirHuecoSchema = z
  .object({
    dia: z.enum(["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]),
    horaInicio: z.string().regex(HORA_REGEX, "Hora de inicio invalida"),
    horaFin: z.string().regex(HORA_REGEX, "Hora de fin invalida"),
    fecha: z.string().regex(FECHA_REGEX, "Fecha invalida"),
    aforo: z.number().int("El aforo debe ser un numero entero").min(1, "El aforo debe ser al menos 1"),
    entrenadorId: z.string().uuid("Entrenador invalido"),
    recurrente: z.boolean(),
  })
  // La comparacion es de texto, no de horas: "horaFin < horaInicio" con
  // strings como "09:30" funciona porque HORA_REGEX exige dos digitos en cada
  // parte (cero a la izquierda incluido), asi que el orden lexicografico
  // coincide con el orden cronologico dentro del mismo dia. No cubre clases
  // que cruzan medianoche, pero el horario del centro no las tiene.
  .refine((datos) => datos.horaFin > datos.horaInicio, {
    message: "La hora de fin debe ser posterior a la de inicio",
    path: ["horaFin"],
  });

export async function abrirHueco(datos: unknown): Promise<{ error?: string }> {
  const resultado = abrirHuecoSchema.safeParse(datos);
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { dia, horaInicio, horaFin, fecha, aforo, entrenadorId, recurrente } = resultado.data;

  // La celda que Elena pulso ya fija el dia de la semana; si la fecha elegida
  // no cae en ese mismo dia, la sesion apareceria en un dia distinto al que
  // ella pulso y parece que la app le movio la clase.
  if (diaSemanaDeFecha(fecha) !== dia) {
    return { error: "La fecha no corresponde a ese dia de la semana" };
  }

  const supabase = await createClient();

  const { data: clase, error: errorClase } = await supabase
    .from("clases")
    .insert({
      dia,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      aforo_max: aforo,
      entrenador_id: entrenadorId,
      recurrente,
    })
    .select()
    .single();
  if (errorClase || !clase) {
    return { error: errorClase?.code === CODIGO_RLS ? "No autorizado" : errorClase?.message ?? "No autorizado" };
  }

  const { error: errorSesion } = await supabase.from("sesiones").insert({
    clase_id: clase.id,
    fecha,
    abierta: true,
  });
  if (errorSesion) {
    await supabase.from("clases").delete().eq("id", clase.id);
    return { error: errorSesion.message };
  }

  revalidatePath("/admin/clases");
  revalidatePath("/entrenador/clases");
  revalidatePath("/cliente");
  return {};
}

export async function cerrarSesion(sesionId: string): Promise<{ error?: string }> {
  const resultado = z.string().uuid("Sesion invalida").safeParse(sesionId);
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("sesiones").update({ abierta: false }).eq("id", resultado.data).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "No autorizado" };

  revalidatePath("/admin/clases");
  revalidatePath("/entrenador/clases");
  revalidatePath("/cliente");
  return {};
}

export async function reabrirSesion(sesionId: string): Promise<{ error?: string }> {
  const resultado = z.string().uuid("Sesion invalida").safeParse(sesionId);
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("sesiones").update({ abierta: true }).eq("id", resultado.data).select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "No autorizado" };

  revalidatePath("/admin/clases");
  revalidatePath("/entrenador/clases");
  revalidatePath("/cliente");
  return {};
}
