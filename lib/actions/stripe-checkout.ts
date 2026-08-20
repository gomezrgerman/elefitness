"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

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

  const session = await stripe.checkout.sessions.create({
    mode: plan.tipo === "mensual" ? "subscription" : "payment",
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    customer_email: user.email,
    client_reference_id: cliente.id,
    metadata: { cliente_id: cliente.id, plan_id: plan.id },
    success_url: `${origin}/cliente?pago=exito`,
    cancel_url: `${origin}/cliente?pago=cancelado`,
  });

  if (!session.url) return { error: "No se pudo iniciar el pago" };
  return { url: session.url };
}
