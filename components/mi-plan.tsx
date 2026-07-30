"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/mock-store";
import { planPorId, pagoDeCliente, bonoDeCliente, creditosRestantes } from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";

export function MiPlan({ clienteId }: { clienteId: string }) {
  const { clientes, planes, pagos, bonosCliente } = useAppStore();
  const cliente = clientes.find((c) => c.id === clienteId);
  if (!cliente) return null;
  const plan = planPorId(planes, cliente.planId);
  const pago = pagoDeCliente(pagos, clienteId);
  const bono = bonoDeCliente(bonosCliente, clienteId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mi plan</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p>
          <span className="text-muted-foreground">Plan: </span>
          {plan?.nombre ?? "—"}
        </p>
        {bono && (
          <p>
            <span className="text-muted-foreground">Creditos restantes: </span>
            {creditosRestantes(bono)} de {bono.creditosTotales}
          </p>
        )}
        {pago && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Estado de pago: </span>
            <BadgeEstado estado={pago.estado} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
