"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { iniciarCheckoutCliente } from "@/lib/actions/stripe-checkout";

export function BotonPagarPlan() {
  const [cargando, setCargando] = useState(false);
  const { toast } = useToast();

  async function pagar() {
    setCargando(true);
    const respuesta = await iniciarCheckoutCliente();
    if (respuesta.error) {
      toast(respuesta.error, "error");
      setCargando(false);
      return;
    }
    if (respuesta.url) window.location.href = respuesta.url;
  }

  return (
    <Button size="sm" onClick={pagar} disabled={cargando}>
      {cargando ? "Redirigiendo..." : "Pagar ahora"}
    </Button>
  );
}
