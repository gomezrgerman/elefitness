"use client";

import { cn } from "@/lib/utils";
import { reservasConfirmadasDeSesion } from "@/lib/selectors";
import { diasDeSemana, formatearDiaCorto, numeroDeDia } from "@/lib/fechas";
import { colorBarraOcupacion } from "./color-ocupacion";
import type { Clase, Sesion, Reserva } from "@/lib/types";

interface Props {
  fecha: string;
  hoy: string;
  clases: Clase[];
  sesiones: Sesion[];
  reservas: Reserva[];
  onIrADia: (fecha: string) => void;
}

export function VistaSemana({ fecha, hoy, clases, sesiones, reservas, onIrADia }: Props) {
  const dias = diasDeSemana(fecha);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {dias.map((dia, idx) => {
        const delDia = sesiones
          .filter((s) => s.fecha === dia)
          .map((s) => ({ sesion: s, clase: clases.find((c) => c.id === s.claseId) }))
          .filter((x): x is { sesion: Sesion; clase: Clase } => Boolean(x.clase))
          .sort((a, b) => a.clase.horaInicio.localeCompare(b.clase.horaInicio));

        return (
          <button
            key={dia}
            type="button"
            onClick={() => onIrADia(dia)}
            className={cn(
              "flex flex-col gap-2 rounded-xl bg-card p-3 text-left text-sm ring-1 ring-foreground/10 opacity-0 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:ring-primary/30 hover:shadow-[0_4px_24px_-8px_var(--primary)]",
              `animate-stagger-${Math.min(idx + 1, 10)}`,
              dia === hoy && "ring-primary/50"
            )}
            style={{ animation: "fade-in-up 0.4s var(--ease-spring) forwards" }}
          >
            <span className="text-xs font-medium text-muted-foreground">
              {formatearDiaCorto(dia)} {numeroDeDia(dia)}
            </span>
            {delDia.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
            {delDia.map(({ sesion, clase }) => {
              const aforo = sesion.aforoEfectivo ?? clase.aforoMax;
              const confirmadas = reservasConfirmadasDeSesion(reservas, sesion.id).length;
              return (
                <div key={sesion.id} className="flex flex-col gap-1">
                  <span className="flex items-center justify-between text-sm">
                    <span>{clase.horaInicio}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {confirmadas}/{aforo}
                    </span>
                  </span>
                  <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", colorBarraOcupacion(confirmadas, aforo))}
                      style={{ width: `${aforo > 0 ? (confirmadas / aforo) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </button>
        );
      })}
    </div>
  );
}
