import Stripe from "stripe";

// Cuenta Stripe propia de Elefitness, independiente de la de Harbiz -- no
// hay ningun riesgo de solapar con las suscripciones que Harbiz ya cobra
// mientras Elena migra clientas poco a poco (ver brief punto 10 y memoria de
// la migracion). Server-only: nunca importar desde un componente cliente.
function requireEnv(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}

export const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2026-07-29.dahlia",
});
