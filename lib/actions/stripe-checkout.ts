"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

// Elena pidio (2026-08-21) que todas las mensualidades se cobren el mismo
// dia del mes, no cada una en su propio aniversario de alta -- mas facil de
// llevar la cuenta que 100 fechas de cobro distintas repartidas por el mes.
// Se ancla al dia 1 del mes siguiente: siempre es un instante futuro (Stripe
// lo exige) y el primer cobro sale prorrateado automaticamente desde hoy
// hasta esa fecha.
function proximoDiaUnoUnix(): number {
  const ahora = new Date();
  const primerDiaMesSiguiente = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1));
  return Math.floor(primerDiaMesSiguiente.getTime() / 1000);
}

// Nunca un link publico de compra (brief punto 10): la clienta solo puede
// pagar autenticada, desde dentro de la app, y siempre con el precio de SU
// plan concreto -- nunca uno generico. client_reference_id lleva el id de
// la clienta para que el webhook sepa que fila de `pagos` actualizar.
export async function iniciarCheckoutCliente(): Promise<{ error?: string; url?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: cliente, error: errorCliente } = await supabase
    .from("clientes")
    .select("id, plan_id")
    .eq("usuario_id", user.id)
    .single();
  if (errorCliente || !cliente) return { error: "No se encontro tu ficha de clienta" };
  if (!cliente.plan_id) return { error: "No tienes ningun plan asignado. Habla con Elena." };

  const { data: plan, error: errorPlan } = await supabase
    .from("planes")
    .select("id, nombre, tipo, stripe_price_id")
    .eq("id", cliente.plan_id)
    .single();
  if (errorPlan || !plan) return { error: "No se pudo encontrar tu plan" };
  if (!plan.stripe_price_id) {
    return { error: "Tu plan todavia no tiene precio configurado en Stripe. Habla con Elena." };
  }

  const origin = (await headers()).get("origin") ?? "";

  const esMensual = plan.tipo === "mensual";

  const session = await stripe.checkout.sessions.create({
    mode: esMensual ? "subscription" : "payment",
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    customer_email: user.email,
    client_reference_id: cliente.id,
    metadata: { cliente_id: cliente.id, plan_id: plan.id },
    success_url: `${origin}/cliente?pago=exito`,
    cancel_url: `${origin}/cliente?pago=cancelado`,
    ...(esMensual
      ? {
          subscription_data: {
            billing_cycle_anchor: proximoDiaUnoUnix(),
            proration_behavior: "create_prorations",
          },
        }
      : {}),
  });

  if (!session.url) return { error: "No se pudo iniciar el pago" };
  return { url: session.url };
}
