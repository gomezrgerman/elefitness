"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ORDEN_DIAS, reservaActivaDeClienteEnSesion } from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";
import { reservarSesion, cancelarReserva } from "@/lib/actions/reservas";
import { cn } from "@/lib/utils";
import type { Clase, Sesion, Reserva } from "@/lib/types";

const ETIQUETA_DIA: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miercoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sabado",
  domingo: "Domingo",
};

interface Props {
  clienteId: string;
  clases: Clase[];
  sesiones: Sesion[];
  reservas: Reserva[];
  ocupacion: Record<string, number>;
}

export function HorarioCliente({ clienteId, clases, sesiones, reservas, ocupacion }: Props) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const hoy = new Date().toISOString().slice(0, 10);

  function reservar(sesionId: string) {
    setError(null);
    startTransition(async () => {
      const respuesta = await reservarSesion(sesionId, clienteId);
      if (respuesta.error) {
        setError(respuesta.error);
        toast(respuesta.error, "error");
      } else {
        toast("Reserva confirmada", "success");
      }
    });
  }

  function cancelar(reservaId: string) {
    setError(null);
    startTransition(async () => {
      const respuesta = await cancelarReserva(reservaId);
      if (respuesta.error) {
        setError(respuesta.error);
        toast(respuesta.error, "error");
      } else {
        toast("Reserva cancelada", "info");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ORDEN_DIAS.map((dia, diaIdx) => {
          const clasesDelDia = clases.filter((c) => c.dia === dia);
          if (clasesDelDia.length === 0) return null;
          return (
            <div
              key={dia}
              className={cn("flex flex-col gap-3 opacity-0", `animate-stagger-${diaIdx + 1}`)}
              style={{ animation: "fade-in-up 0.5s var(--ease-spring) forwards" }}
            >
              <h3 className="font-medium">{ETIQUETA_DIA[dia]}</h3>
              {clasesDelDia.map((clase, claseIdx) => {
                const sesionesDeClase = sesiones
                  .filter((s) => s.claseId === clase.id && s.fecha >= hoy)
                  .sort((a, b) => a.fecha.localeCompare(b.fecha));
                return sesionesDeClase.map((sesion, sesIdx) => {
                  const aforo = sesion.aforoEfectivo ?? clase.aforoMax;
                  const libres = aforo - (ocupacion[sesion.id] ?? 0);
                  const miReserva = reservaActivaDeClienteEnSesion(reservas, clienteId, sesion.id);
                  const staggerIdx = sesIdx + 1;
                  return (
                    <Card
                      key={sesion.id}
                      className={cn("opacity-0", `animate-stagger-${Math.min(staggerIdx, 10)}`)}
                      style={{ animation: "fade-in-up 0.5s var(--ease-spring) forwards" }}
                    >
                      <CardHeader>
                        <CardTitle className="text-base">
                          {sesion.fecha} · {clase.horaInicio} - {clase.horaFin}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                libres <= 0 ? "bg-red-500/60" : libres <= 2 ? "bg-amber-500/60" : "bg-primary"
                              )}
                              style={{ width: `${aforo > 0 ? ((aforo - Math.max(libres, 0)) / aforo) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {Math.max(libres, 0)}/{aforo}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {miReserva ? (
                          <div className="flex items-center justify-between">
                            <BadgeEstado estado={miReserva.estado} />
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={pendiente}
                              onClick={() => cancelar(miReserva.id)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" disabled={pendiente} onClick={() => reservar(sesion.id)}>
                            {libres > 0 ? "Reservar" : "Unirse a lista de espera"}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                });
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
