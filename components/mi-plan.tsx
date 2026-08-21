import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  planPorId,
  pagoDeCliente,
  bonoDeCliente,
  creditosRestantes,
} from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";
import { BotonPagarPlan } from "./boton-pagar-plan";
import { CreditCardIcon, ClockIcon, CalendarClockIcon } from "lucide-react";
import type { Cliente, Plan, Pago, BonoCliente, Clase } from "@/lib/types";

interface Props {
  cliente: Cliente;
  planes: Plan[];
  pagos: Pago[];
  bonosCliente: BonoCliente[];
  clases: Clase[];
}

function etiquetaDia(dia: string): string {
  return dia.charAt(0).toUpperCase() + dia.slice(1);
}

export function MiPlan({ cliente, planes, pagos, bonosCliente, clases }: Props) {
  const plan = planPorId(planes, cliente.planId);
  const pago = pagoDeCliente(pagos, cliente.id);
  const bono = bonoDeCliente(bonosCliente, cliente.id);
  const restantes = bono ? creditosRestantes(bono) : 0;
  const total = bono?.creditosTotales ?? 0;
  const porcentaje = total > 0 ? (restantes / total) * 100 : 0;
  const claseHabitual = cliente.claseHabitualId ? clases.find((c) => c.id === cliente.claseHabitualId) : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mi plan</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <CreditCardIcon className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-base font-semibold">{plan?.nombre ?? "Sin plan"}</p>
            <p className="text-xs text-muted-foreground">
              {plan?.tipo === "mensual" ? "Cuota mensual" : "Bono de clases"}
              {plan?.precio ? ` · ${plan.precio} EUR` : ""}
            </p>
          </div>
        </div>

        {claseHabitual && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2.5">
            <CalendarClockIcon className="size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Tu horario fijo</p>
              <p className="text-sm font-medium">
                {etiquetaDia(claseHabitual.dia)} {claseHabitual.horaInicio}–{claseHabitual.horaFin}
              </p>
              <p className="text-xs text-muted-foreground">
                Si esta semana no puedes venir, cancela igualmente: tu horario fijo no cambia.
              </p>
            </div>
          </div>
        )}

        {bono && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Creditos</span>
              <span className="font-medium tabular-nums">
                {restantes} / {total}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${porcentaje}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {restantes === 0
                ? "Sin creditos disponibles. Compra un nuevo bono para reservar."
                : `${restantes} ${restantes === 1 ? "clase restante" : "clases restantes"}`}
            </p>
          </div>
        )}

        {pago && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <ClockIcon className="size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Estado de pago</p>
                <p className="text-sm font-medium">
                  {pago.ultimoCobro ? `Ultimo cobro: ${pago.ultimoCobro}` : "Sin cobros"}
                </p>
                {pago.proximoCobro && (
                  <p className="text-xs text-muted-foreground">
                    Proximo: {pago.proximoCobro}
                  </p>
                )}
              </div>
            </div>
            {pago.estado === "al_dia" ? (
              <BadgeEstado estado={pago.estado} />
            ) : plan?.stripePriceId ? (
              <BotonPagarPlan />
            ) : (
              <BadgeEstado estado={pago.estado} />
            )}
          </div>
        )}

        {!pago && !bono && (
          <p className="text-sm text-muted-foreground">
            No hay informacion de pagos disponible.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
