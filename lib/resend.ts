import { Resend } from "resend";

// Sin dominio verificado todavia (elefitness.es pendiente en Resend), asi
// que solo puede mandar al email de la cuenta -- ver nota en .env.local.
// Cuando se verifique, cambiar REMITENTE a algo tipo "Elefitness <avisos@elefitness.es>".
export const REMITENTE = "Elefitness <onboarding@resend.dev>";

// Perezoso a proposito (igual que createAdminClient en lib/supabase/admin.ts):
// construirlo a nivel de modulo leeria RESEND_API_KEY antes de que Next (o un
// script suelto) termine de cargar el .env, y fallaria en frio.
export function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Falta la variable de entorno RESEND_API_KEY");
  return new Resend(apiKey);
}
