import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { planPorId, pagoDeCliente, bonoDeCliente, creditosRestantes } from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";
import type { Cliente, Plan, Pago, BonoCliente } from "@/lib/types";

interface Props {
  cliente: Cliente;
  planes: Plan[];
  pagos: Pago[];
  bonosCliente: BonoCliente[];
}

export function MiPlan({ cliente, planes, pagos, bonosCliente }: Props) {
  const plan = planPorId(planes, cliente.planId);
  const pago = pagoDeCliente(pagos, cliente.id);
  const bono = bonoDeCliente(bonosCliente, cliente.id);

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
