import { z } from "zod";

export const clienteFormSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio"),
  email: z.string().email("Email invalido"),
  telefono: z.string().min(6, "Telefono invalido"),
  planId: z.string().min(1, "Selecciona un plan"),
  notasRutina: z.string().max(2000).optional().default(""),
});

export type ClienteFormValues = z.infer<typeof clienteFormSchema>;
