import { z } from "zod";

// diasSemanaHabituales alimenta el tope mensual de bonos de recuperacion
// (1/mes con 1-2 dias, 2/mes con 3+), asi que tiene que poder fijarse al dar de
// alta y al editar; si no, toda clienta real se queda con el default 1 y la
// regla de los 3+ dias nunca se llega a aplicar en produccion.
export const clienteFormSchema = z
  .object({
    nombre: z.string().min(2, "El nombre es obligatorio"),
    email: z.string().email("Email invalido"),
    telefono: z.string().min(6, "Telefono invalido"),
    // null = sin plan asignado (clienta "en el aire", sin cobro activo). En
    // ese caso no hay pago que registrar, asi que importe/metodo no aplican.
    planId: z.string().nullable(),
    // Independiente del precio de catalogo del plan: cubre precios legacy no
    // migrados y "Cuota personalizada" (clientas en efectivo con un precio
    // propio negociado a mano). Tambien sirve para corregir un pago parcial
    // puntual sin tener que cambiar de plan.
    importe: z.coerce.number().positive("El importe debe ser mayor que 0").optional(),
    metodo: z.enum(["stripe", "efectivo", "transferencia"]).optional(),
    notasRutina: z.string().max(2000).optional().default(""),
    diasSemanaHabituales: z.coerce
      .number()
      .int("Los dias por semana deben ser un numero entero")
      .min(1, "Minimo 1 dia por semana")
      .max(7, "Maximo 7 dias por semana")
      .default(1),
    // null = entrena con cualquiera (caso comun, sin restriccion de agenda).
    entrenadorRestringidoId: z.string().uuid("Entrenador invalido").nullable().default(null),
  })
  .superRefine((datos, ctx) => {
    if (!datos.planId) return;
    if (datos.importe === undefined) {
      ctx.addIssue({ path: ["importe"], code: z.ZodIssueCode.custom, message: "El importe debe ser mayor que 0" });
    }
    if (datos.metodo === undefined) {
      ctx.addIssue({ path: ["metodo"], code: z.ZodIssueCode.custom, message: "Selecciona un metodo de pago" });
    }
  });

export type ClienteFormValues = z.infer<typeof clienteFormSchema>;
