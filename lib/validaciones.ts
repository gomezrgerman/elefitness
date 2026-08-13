import { z } from "zod";

// diasSemanaHabituales alimenta el tope mensual de bonos de recuperacion
// (1/mes con 1-2 dias, 2/mes con 3+), asi que tiene que poder fijarse al dar de
// alta y al editar; si no, toda clienta real se queda con el default 1 y la
// regla de los 3+ dias nunca se llega a aplicar en produccion.
export const clienteFormSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio"),
  email: z.string().email("Email invalido"),
  telefono: z.string().min(6, "Telefono invalido"),
  planId: z.string().min(1, "Selecciona un plan"),
  notasRutina: z.string().max(2000).optional().default(""),
  diasSemanaHabituales: z.coerce
    .number()
    .int("Los dias por semana deben ser un numero entero")
    .min(1, "Minimo 1 dia por semana")
    .max(7, "Maximo 7 dias por semana")
    .default(1),
  // null = entrena con cualquiera (caso comun, sin restriccion de agenda).
  entrenadorRestringidoId: z.string().uuid("Entrenador invalido").nullable().default(null),
});

export type ClienteFormValues = z.infer<typeof clienteFormSchema>;
