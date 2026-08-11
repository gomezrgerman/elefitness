"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { reservaActivaDeClienteEnSesion } from "@/lib/selectors";
import { formatearDiaLargo, instanteEnEspana } from "@/lib/fechas";
import { BadgeEstado } from "./badge-estado";
import { reservarSesion, cancelarReserva } from "@/lib/actions/reservas";
import type { Clase, Sesion, Reserva } from "@/lib/types";

interface Props {
  clienteId: string;
  hoy: string;
  limite: string;
  // Elena pidio que la clienta no vea cuantas plazas quedan, para que no elija
  // las clases con menos gente: al navegador solo llega si hay hueco o no.
  sesionesLibres: Record<string, boolean>;
  clases: Clase[];
  sesiones: Sesion[];
  reservas: Reserva[];
}

export function HorarioCliente({ clienteId, hoy, limite, sesionesLibres, clases, sesiones, reservas }: Props) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reservar(sesionId: string) {
    setError(null);
    startTransition(async () => {
      const respuesta = await reservarSesion(sesionId, clienteId);
      if (respuesta.error) setError(respuesta.error);
    });
  }

  function cancelar(reservaId: string) {
    setError(null);
    startTransition(async () => {
      const respuesta = await cancelarReserva(reservaId);
      if (respuesta.error) setError(respuesta.error);
    });
  }

  // Solo se muestran las sesiones reservables: desde ahora (no solo desde hoy
  // por fecha) hasta el limite de la ventana. El filtro por fecha es solo un
  // primer recorte barato; la clase de hoy que ya ha empezado se descarta
  // comparando el instante real via instanteEnEspana, igual que hace la RPC.
  // Sin esto, una clase de las 09:00 seguia mostrando "Reservar" a las 20:00 y
  // la RPC la rechazaba con "Esta sesion ya ha pasado".
  const ahora = new Date();
  const visibles = sesiones
    .filter((s) => s.fecha >= hoy && s.fecha <= limite)
    .map((s) => ({ sesion: s, clase: clases.find((c) => c.id === s.claseId) }))
    .filter((x): x is { sesion: Sesion; clase: Clase } => Boolean(x.clase))
    .filter((x) => instanteEnEspana(x.sesion.fecha, x.clase.horaInicio) > ahora)
    .sort((a, b) =>
      a.sesion.fecha === b.sesion.fecha
        ? a.clase.horaInicio.localeCompare(b.clase.horaInicio)
        : a.sesion.fecha.localeCompare(b.sesion.fecha)
    );

  if (visibles.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay clases disponibles ahora mismo.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibles.map(({ sesion, clase }) => {
          const hayHueco = sesionesLibres[sesion.id] ?? false;
          const miReserva = reservaActivaDeClienteEnSesion(reservas, clienteId, sesion.id);
          return (
            <Card key={sesion.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {formatearDiaLargo(sesion.fecha)}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {clase.horaInicio} - {clase.horaFin} · {hayHueco ? "Libre" : "Completo"}
                </p>
              </CardHeader>
              <CardContent>
                {miReserva ? (
                  <div className="flex items-center justify-between">
                    <BadgeEstado estado={miReserva.estado} />
                    <Button variant="outline" size="sm" disabled={pendiente} onClick={() => cancelar(miReserva.id)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" disabled={pendiente} onClick={() => reservar(sesion.id)}>
                    {hayHueco ? "Reservar" : "Unirse a lista de espera"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
