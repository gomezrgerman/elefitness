"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { reservaActivaDeClienteEnSesion, usuarioPorId } from "@/lib/selectors";
import { formatearDiaLargo, formatearDiaCorto, numeroDeDia, instanteEnEspana } from "@/lib/fechas";
import { BadgeEstado } from "./badge-estado";
import { reservarSesion, cancelarReserva } from "@/lib/actions/reservas";
import { cn } from "@/lib/utils";
import type { Clase, Sesion, Reserva, Usuario } from "@/lib/types";

export interface DiaDisponibilidad {
  fecha: string;
  // Hay alguna sesion que cualquiera podria intentar reservar ese dia (aunque
  // este completa y solo entre en lista de espera). No dice si hay plaza: eso
  // es justo lo que Elena no quiere que se filtre por dia.
  tieneHueco: boolean;
  // La clienta ya tiene una reserva activa ese dia, incluidas las sesiones
  // cerradas donde Elena la metio a mano.
  tieneReserva: boolean;
}

interface Props {
  clienteId: string;
  hoy: string;
  limite: string;
  dias: DiaDisponibilidad[];
  // Elena pidio que la clienta no vea cuantas plazas quedan, para que no
  // elija las clases con menos gente: al navegador solo llega si hay hueco o
  // no. Ni la tira de dias (arriba) ni esta lista exponen un conteo.
  sesionesLibres: Record<string, boolean>;
  clases: Clase[];
  sesiones: Sesion[];
  reservas: Reserva[];
  usuarios: Usuario[];
}

export function HorarioCliente({
  clienteId,
  hoy,
  limite,
  dias,
  sesionesLibres,
  clases,
  sesiones,
  reservas,
  usuarios,
}: Props) {
  // Arranca en el primer dia con hueco, para que el pulgar no tenga que
  // deslizar antes de ver algo reservable. Si ningun dia tiene hueco (mala
  // semana, o la clienta solo tiene reservas en sesiones cerradas), cae al
  // primer dia de la ventana. `dias` es una prop determinista calculada en el
  // servidor, asi que este estado inicial coincide en servidor y cliente.
  const [diaSeleccionado, setDiaSeleccionado] = useState(
    () => dias.find((d) => d.tieneHueco)?.fecha ?? dias[0]?.fecha ?? hoy
  );
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Reserva cuya cancelacion esta pendiente de confirmar. Solo se usa para
  // sesiones cerradas: cancelar una abierta sigue siendo un solo toque, como
  // antes.
  const [confirmandoCancelar, setConfirmandoCancelar] = useState<string | null>(null);
  const { toast } = useToast();

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
    setConfirmandoCancelar(null);
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

  function iniciarCancelacion(sesion: Sesion, reservaId: string) {
    // La sesion cerrada es la unica que necesita el aviso: si esta abierta,
    // cancelar sigue funcionando en un solo toque, igual que antes.
    if (sesion.abierta) {
      cancelar(reservaId);
    } else {
      setConfirmandoCancelar(reservaId);
    }
  }

  // Mismo recorte que ya existia: dentro de la ventana de tres semanas y sin
  // contar sesiones ya empezadas, comparando el instante real via
  // instanteEnEspana (una comparacion solo de fecha no basta, ver
  // lib/fechas.ts). `sesiones` ya llega filtrada desde el servidor: sin las
  // cerradas ni las de otro entrenador, salvo la sesion donde la clienta ya
  // tiene reserva.
  const ahora = new Date();
  const visibles = sesiones
    .filter((s) => s.fecha >= hoy && s.fecha <= limite)
    .map((s) => ({ sesion: s, clase: clases.find((c) => c.id === s.claseId) }))
    .filter((x): x is { sesion: Sesion; clase: Clase } => Boolean(x.clase))
    .filter((x) => instanteEnEspana(x.sesion.fecha, x.clase.horaInicio) > ahora);

  const delDia = visibles
    .filter((x) => x.sesion.fecha === diaSeleccionado)
    .sort((a, b) => {
      const miA = reservaActivaDeClienteEnSesion(reservas, clienteId, a.sesion.id);
      const miB = reservaActivaDeClienteEnSesion(reservas, clienteId, b.sesion.id);
      // Su propia reserva va arriba del todo; el resto, por hora.
      if (Boolean(miA) !== Boolean(miB)) return miA ? -1 : 1;
      return a.clase.horaInicio.localeCompare(b.clase.horaInicio);
    });

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Tira de dias: deslizable con el pulgar, de hoy al final de la
          ventana de tres semanas. Los dias sin ninguna sesion reservable se
          ven apagados; los que ya tienen su reserva llevan un punto. Ninguno
          se desactiva: un dia apagado puede seguir teniendo su propia
          reserva (cerrada) que necesita poder cancelar. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {dias.map((dia) => {
          const seleccionado = dia.fecha === diaSeleccionado;
          return (
            <button
              key={dia.fecha}
              type="button"
              onClick={() => setDiaSeleccionado(dia.fecha)}
              aria-pressed={seleccionado}
              className={cn(
                "relative flex shrink-0 flex-col items-center gap-0.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                seleccionado
                  ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30"
                  : dia.tieneHueco
                    ? "border-input text-foreground hover:bg-muted"
                    : "border-transparent text-muted-foreground/50"
              )}
            >
              <span className="text-[0.65rem] uppercase tracking-wide">{formatearDiaCorto(dia.fecha)}</span>
              <span className="text-base font-semibold tabular-nums">{numeroDeDia(dia.fecha)}</span>
              {dia.tieneReserva && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" aria-hidden />}
            </button>
          );
        })}
      </div>

      {/* Horas del dia elegido. */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">{formatearDiaLargo(diaSeleccionado)}</p>

        {delDia.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay clases disponibles este dia.</p>
        ) : (
          delDia.map(({ sesion, clase }, idx) => {
            const hayHueco = sesionesLibres[sesion.id] ?? false;
            const miReserva = reservaActivaDeClienteEnSesion(reservas, clienteId, sesion.id);
            const entrenador = usuarioPorId(usuarios, clase.entrenadorId);

            return (
              <Card
                key={sesion.id}
                className={cn(
                  "opacity-0",
                  `animate-stagger-${Math.min(idx + 1, 10)}`,
                  miReserva && "border-primary/30 bg-primary/5"
                )}
                style={{ animation: "fade-in-up 0.5s var(--ease-spring) forwards" }}
              >
                <CardHeader>
                  <CardTitle className="text-base">
                    {clase.horaInicio} - {clase.horaFin}
                  </CardTitle>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">{entrenador?.nombre ?? "Por confirmar"}</p>
                    {!miReserva && (
                      <span className={cn("text-xs font-medium shrink-0", hayHueco ? "text-primary" : "text-red-600")}>
                        {hayHueco ? "Libre" : "Completo"}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {miReserva ? (
                    confirmandoCancelar === miReserva.id ? (
                      <div className="flex flex-col gap-2 rounded-md bg-muted p-2">
                        <p className="text-xs">
                          Esta hora esta cerrada: si cancelas no podras volver a reservarla tu sola, tendras que
                          hablar con Elena. El credito no se pierde si cancelas con mas de 24h de antelacion, pero
                          si la plaza.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={pendiente}
                            onClick={() => cancelar(miReserva.id)}
                          >
                            Confirmar cancelacion
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setConfirmandoCancelar(null)}>
                            Volver
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <BadgeEstado estado={miReserva.estado} />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendiente}
                          onClick={() => iniciarCancelacion(sesion, miReserva.id)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )
                  ) : (
                    <Button size="sm" disabled={pendiente} onClick={() => reservar(sesion.id)}>
                      {hayHueco ? "Reservar" : "Unirse a lista de espera"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
