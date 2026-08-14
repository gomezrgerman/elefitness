"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BadgeEstado } from "@/components/badge-estado";
import {
  reservasConfirmadasDeSesion,
  reservasListaEsperaDeSesion,
  usuarioPorId,
  clientePorId,
  planPorId,
} from "@/lib/selectors";
import { marcarAsistencia } from "@/lib/actions/asistencia";
import { cancelarReserva } from "@/lib/actions/reservas";
import { formatearDiaLargo, instanteEnEspana } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { colorBarraOcupacion } from "./color-ocupacion";
import type { Clase, Sesion, Reserva, Cliente, Usuario, Plan, EstadoAsistencia } from "@/lib/types";

interface Props {
  fecha: string;
  ahora: string;
  clases: Clase[];
  sesiones: Sesion[];
  reservas: Reserva[];
  clientes: Cliente[];
  usuarios: Usuario[];
  planes: Plan[];
  puedeQuitar: boolean;
}

const ESTADOS: { valor: EstadoAsistencia; etiqueta: string }[] = [
  { valor: "asistio", etiqueta: "Vino" },
  { valor: "no_asistio", etiqueta: "Falto" },
  { valor: "pendiente", etiqueta: "Sin marcar" },
];

export function VistaDia({
  fecha,
  ahora,
  clases,
  sesiones,
  reservas,
  clientes,
  usuarios,
  planes,
  puedeQuitar,
}: Props) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState<string | null>(null);

  const sesionesDelDia = sesiones
    .filter((s) => s.fecha === fecha)
    .map((s) => ({ sesion: s, clase: clases.find((c) => c.id === s.claseId) }))
    .filter((x): x is { sesion: Sesion; clase: Clase } => Boolean(x.clase))
    .sort((a, b) => a.clase.horaInicio.localeCompare(b.clase.horaInicio));

  function cambiarAsistencia(reservaId: string, asistencia: EstadoAsistencia) {
    setError(null);
    startTransition(async () => {
      const respuesta = await marcarAsistencia(reservaId, asistencia);
      if (respuesta.error) setError(respuesta.error);
    });
  }

  function quitar(reservaId: string) {
    setError(null);
    setConfirmandoQuitar(null);
    startTransition(async () => {
      const respuesta = await cancelarReserva(reservaId);
      if (respuesta.error) setError(respuesta.error);
    });
  }

  if (sesionesDelDia.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="font-medium">{formatearDiaLargo(fecha)}</h3>
        <p className="text-sm text-muted-foreground">No hay clases este dia.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-medium">{formatearDiaLargo(fecha)}</h3>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {sesionesDelDia.map(({ sesion, clase }, idx) => {
        const confirmadas = reservasConfirmadasDeSesion(reservas, sesion.id);
        const enEspera = reservasListaEsperaDeSesion(reservas, sesion.id);
        const aforo = sesion.aforoEfectivo ?? clase.aforoMax;
        const entrenador = usuarioPorId(usuarios, clase.entrenadorId);
        const inicio = instanteEnEspana(sesion.fecha, clase.horaInicio);
        const yaEmpezo = inicio.getTime() <= new Date(ahora).getTime();
        const faltanMenosDe24h = !yaEmpezo && inicio.getTime() - new Date(ahora).getTime() < 24 * 3600 * 1000;

        return (
          <Card
            key={sesion.id}
            className={cn("opacity-0", `animate-stagger-${Math.min(idx + 1, 10)}`)}
            style={{ animation: "fade-in-up 0.5s var(--ease-spring) forwards" }}
          >
            <CardHeader>
              <CardTitle className="text-base">
                {clase.horaInicio} - {clase.horaFin}
              </CardTitle>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm text-muted-foreground">{entrenador?.nombre ?? "—"}</p>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", colorBarraOcupacion(confirmadas.length, aforo))}
                      style={{ width: `${aforo > 0 ? (confirmadas.length / aforo) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {confirmadas.length}/{aforo}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {confirmadas.length === 0 && enEspera.length === 0 && (
                <p className="text-muted-foreground">Sin reservas todavia</p>
              )}

              {confirmadas.map((reserva) => {
                const cliente = clientePorId(clientes, reserva.clienteId);
                const usuario = cliente ? usuarioPorId(usuarios, cliente.usuarioId) : undefined;
                const plan = cliente ? planPorId(planes, cliente.planId) : undefined;
                const pierdeCredito = faltanMenosDe24h && (plan ? plan.tipo === "bono" : true);

                return (
                  <div key={reserva.id} className="flex flex-col gap-2 border-b pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{usuario?.nombre ?? "—"}</span>
                      {puedeQuitar && !yaEmpezo && confirmandoQuitar !== reserva.id && (
                        <Button
                          variant="ghost"
                          size="default"
                          disabled={pendiente}
                          onClick={() => setConfirmandoQuitar(reserva.id)}
                        >
                          Quitar
                        </Button>
                      )}
                    </div>

                    {puedeQuitar && !yaEmpezo && confirmandoQuitar === reserva.id && (
                      <div className="flex flex-col gap-2 rounded-md bg-muted p-2">
                        <p className="text-xs">
                          {pierdeCredito
                            ? "Quedan menos de 24h: al quitarla perdera el credito de esta clase."
                            : "Se le libera la plaza y entrara quien este primero en la lista de espera."}
                        </p>
                        <div className="flex gap-2">
                          <Button variant="destructive" size="default" disabled={pendiente} onClick={() => quitar(reserva.id)}>
                            Confirmar
                          </Button>
                          <Button variant="outline" size="default" onClick={() => setConfirmandoQuitar(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {ESTADOS.map(({ valor, etiqueta }) => (
                        <Button
                          key={valor}
                          size="default"
                          variant={reserva.asistencia === valor ? "default" : "outline"}
                          disabled={pendiente || !yaEmpezo}
                          onClick={() => cambiarAsistencia(reserva.id, valor)}
                        >
                          {etiqueta}
                        </Button>
                      ))}
                    </div>
                    {!yaEmpezo && <p className="text-xs text-muted-foreground">La clase aun no ha empezado.</p>}
                    {puedeQuitar && yaEmpezo && (
                      <p className="text-xs text-muted-foreground">La clase ya ha empezado, no se puede quitar.</p>
                    )}
                  </div>
                );
              })}

              {enEspera.map((reserva) => {
                const cliente = clientePorId(clientes, reserva.clienteId);
                const usuario = cliente ? usuarioPorId(usuarios, cliente.usuarioId) : undefined;
                return (
                  <div key={reserva.id} className="flex items-center justify-between">
                    <span>{usuario?.nombre ?? "—"}</span>
                    <BadgeEstado estado={reserva.estado} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
