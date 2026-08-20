import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyEnEspana } from "@/lib/fechas";
import type { TablesUpdate } from "@/lib/database.types";

// Unica excepcion a "todo server actions" del proyecto (ver CLAUDE.md):
// Stripe llama a esta URL directamente, no hay sesion de usuario que
// autentique la peticion. La firma del webhook es la unica verificacion.
// service_role es obligatorio aqui: no hay auth.uid() que satisfaga RLS.
export async function POST(request: Request) {
  const firma = request.headers.get("stripe-signature");
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;
  if (!firma || !secreto) {
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 500 });
  }

  const cuerpo = await request.text();
  let evento: Stripe.Event;
  try {
    evento = stripe.webhooks.constructEvent(cuerpo, firma, secreto);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Firma invalida";
    return NextResponse.json({ error: mensaje }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (evento.type) {
    case "checkout.session.completed": {
      const session = evento.data.object as Stripe.Checkout.Session;
      const clienteId = session.client_reference_id ?? session.metadata?.cliente_id;
      if (!clienteId) break;

      const cambios: TablesUpdate<"pagos"> = {
        estado: "al_dia",
        ultimo_cobro: hoyEnEspana(),
      };

      if (session.mode === "subscription" && typeof session.subscription === "string") {
        cambios.stripe_subscription_id = session.subscription;
        const suscripcion = await stripe.subscriptions.retrieve(session.subscription);
        const finPeriodo = suscripcion.items.data[0]?.current_period_end;
        if (finPeriodo) {
          cambios.proximo_cobro = new Date(finPeriodo * 1000).toISOString().slice(0, 10);
        }
      }

      await supabase.from("pagos").update(cambios).eq("cliente_id", clienteId);
      break;
    }

    case "invoice.paid": {
      const invoice = evento.data.object as Stripe.Invoice;
      const suscripcionId =
        typeof invoice.parent?.subscription_details?.subscription === "string"
          ? invoice.parent.subscription_details.subscription
          : undefined;
      if (!suscripcionId) break;

      const suscripcion = await stripe.subscriptions.retrieve(suscripcionId);
      const finPeriodo = suscripcion.items.data[0]?.current_period_end;

      await supabase
        .from("pagos")
        .update({
          estado: "al_dia",
          ultimo_cobro: hoyEnEspana(),
          proximo_cobro: finPeriodo ? new Date(finPeriodo * 1000).toISOString().slice(0, 10) : null,
        })
        .eq("stripe_subscription_id", suscripcionId);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = evento.data.object as Stripe.Invoice;
      const suscripcionId =
        typeof invoice.parent?.subscription_details?.subscription === "string"
          ? invoice.parent.subscription_details.subscription
          : undefined;
      if (!suscripcionId) break;

      await supabase.from("pagos").update({ estado: "moroso" }).eq("stripe_subscription_id", suscripcionId);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ recibido: true });
}
