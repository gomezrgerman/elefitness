"use client";

import { useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { BadgeEstado } from "./badge-estado";
import { reservarSesion, cancelarReserva } from "@/lib/actions/reservas";
import { reservaActivaDeClienteEnSesion } from "@/lib/selectors";
import {
  formatearDiaLargo,
  formatearMes,
  diasDeMes,
  huecosIniciales,
  numeroDeDia,
  instanteEnEspana,
  mismoMes,
  sumarDias,
  sumarMeses,
} from "@/lib/fechas";
import { cn } from "@/lib/utils";
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

const CABECERAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function sesionesDelDia(clases: Clase[], sesiones: Sesion[], fecha: string): { sesion: Sesion; clase: Clase }[] {
  return sesiones
    .filter((s) => s.fecha === fecha)
    .map((sesion) => ({ sesion, clase: clases.find((c) => c.id === sesion.claseId) }))
    .filter((x): x is { sesion: Sesion; clase: Clase } => Boolean(x.clase));
}

export function ReservaCliente({ clienteId, hoy, limite, sesionesLibres, clases, sesiones, reservas }: Props) {
  const ahora = new Date();

  // Solo sesiones reservables: dentro de la ventana [hoy, limite] y con la
  // clase todavia sin empezar (mismo criterio que la vista anterior y que la RPC).
  function sesionesReservables(fecha: string): { sesion: Sesion; clase: Clase }[] {
    return sesionesDelDia(clases, sesiones, fecha)
      .filter(({ sesion }) => sesion.fecha <= limite)
      .filter(({ sesion, clase }) => instanteEnEspana(sesion.fecha, clase.horaInicio) > ahora);
  }

  function primerDiaReservable(): string | null {
    for (let i = 0; ; i++) {
      const fecha = sumarDias(hoy, i);
      if (fecha > limite) break;
      if (sesionesReservables(fecha).length > 0) return fecha;
    }
    return null;
  }

  // El calendario arranca plegado: no se renderiza hasta que la clienta pulsa
  // "Reservar clase aquí", para no pagar su coste al cargar la pagina.
  const [abierto, setAbierto] = useState(false);
  const diaInicial = primerDiaReservable() ?? hoy;
  const [dia, setDia] = useState(diaInicial);
  const [mes, setMes] = useState(() => diaInicial.slice(0, 7) + "-01");
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const hayFuturo = sumarDias(limite, 1) > hoy;

  function elegirDia(fecha: string) {
    setDia(fecha);
    if (!mismoMes(mes, fecha)) setMes(fecha.slice(0, 7) + "-01");
  }

  function reservar(sesionId: string) {
    setError(null);
    setPendiente(true);
    void (async () => {
      const respuesta = await reservarSesion(sesionId, clienteId);
      setPendiente(false);
      if (respuesta.error) {
        setError(respuesta.error);
        toast(respuesta.error, "error");
      } else {
        toast("Reserva confirmada", "success");
      }
    })();
  }

  function cancelar(reservaId: string) {
    setError(null);
    setPendiente(true);
    void (async () => {
      const respuesta = await cancelarReserva(reservaId);
      setPendiente(false);
      if (respuesta.error) {
        setError(respuesta.error);
        toast(respuesta.error, "error");
      } else {
        toast("Reserva cancelada", "info");
      }
    })();
  }

  const visibles = sesionesReservables(dia);

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant={abierto ? "outline" : "default"}
        className="w-full sm:w-auto"
        aria-expanded={abierto}
        aria-controls="panel-reserva"
        onClick={() => setAbierto(!abierto)}
      >
        <CalendarIcon aria-hidden="true" />
        {abierto ? "Ocultar calendario" : "Reservar clase aquí"}
      </Button>

      {abierto && (
        <div id="panel-reserva" className="flex flex-col gap-6 lg:flex-row">
          <div className="lg:w-2/3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold capitalize">{formatearMes(mes)}</p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon-lg"
                  aria-label="Mes anterior"
                  disabled={mes.slice(0, 7) === hoy.slice(0, 7)}
                  onClick={() => setMes(sumarMeses(mes, -1))}
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-lg"
                  aria-label="Mes siguiente"
                  onClick={() => setMes(sumarMeses(mes, 1))}
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {CABECERAS.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
              {Array.from({ length: huecosIniciales(mes) }, (_, i) => (
                <span key={`hueco-${i}`} aria-hidden="true" />
              ))}
              {diasDeMes(mes).map((fecha, idx) => {
                const reservables = sesionesReservables(fecha);
                if (reservables.length === 0) {
                  return (
                    <span
                      key={fecha}
                      className="flex min-h-11 items-center justify-center rounded-xl text-sm text-muted-foreground/30"
                    >
                      {numeroDeDia(fecha)}
                    </span>
                  );
                }
                const hayHueco = reservables.some(({ sesion }) => sesionesLibres[sesion.id] ?? false);
                return (
                  <button
                    key={fecha}
                    type="button"
                    aria-pressed={dia === fecha}
                    onClick={() => elegirDia(fecha)}
                    className={cn(
                      "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl bg-card text-sm ring-1 ring-foreground/10 transition-colors duration-200 hover:ring-primary/40 active:scale-[0.97]",
                      `animate-stagger-${Math.min(idx + 1, 10)}`,
                      dia === fecha && "bg-primary text-primary-foreground ring-primary",
                      fecha === hoy && dia !== fecha && "font-semibold text-primary ring-primary/40"
                    )}
                    style={{ animation: "fade-in-up 0.4s var(--ease-spring) forwards" }}
                  >
                    <span>{numeroDeDia(fecha)}</span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1 rounded-full",
                        hayHueco
                          ? dia === fecha
                            ? "bg-primary-foreground"
                            : "bg-emerald-500"
                          : dia === fecha
                            ? "bg-primary-foreground"
                            : "bg-red-500"
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border pt-6 lg:w-1/3 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <p className="text-sm font-semibold capitalize">{formatearDiaLargo(dia)}</p>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            {visibles.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {hayFuturo ? "No hay clases para este día." : "No hay clases disponibles ahora mismo."}
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {visibles.map(({ sesion, clase }) => {
                  const hayHueco = sesionesLibres[sesion.id] ?? false;
                  const miReserva = reservaActivaDeClienteEnSesion(reservas, clienteId, sesion.id);
                  return (
                    <li
                      key={sesion.id}
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3",
                        hayHueco ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {clase.horaInicio} – {clase.horaFin}
                        </p>
                        <p className={cn("text-xs", hayHueco ? "text-emerald-400" : "text-red-400")}>
                          {hayHueco ? "Disponible" : "Completo"}
                        </p>
                      </div>

                      {miReserva ? (
                        <div className="flex items-center gap-2">
                          <BadgeEstado estado={miReserva.estado} />
                          <Button variant="outline" disabled={pendiente} onClick={() => cancelar(miReserva.id)}>
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          disabled={pendiente}
                          variant={hayHueco ? "default" : "outline"}
                          className={cn(
                            !hayHueco &&
                              "border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200"
                          )}
                          onClick={() => reservar(sesion.id)}
                        >
                          {hayHueco ? "Reservar" : "Lista de espera"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}