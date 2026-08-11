"use client";

import { reservasConfirmadasDeSesion } from "@/lib/selectors";
import { diasDeSemana, formatearDiaCorto, numeroDeDia } from "@/lib/fechas";
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
      {dias.map((dia) => {
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
            className={`flex flex-col gap-2 rounded-md border p-3 text-left transition hover:bg-muted ${
              dia === hoy ? "border-primary" : ""
            }`}
          >
            <span className="text-xs font-medium text-muted-foreground">
              {formatearDiaCorto(dia)} {numeroDeDia(dia)}
            </span>
            {delDia.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
            {delDia.map(({ sesion, clase }) => {
              const aforo = sesion.aforoEfectivo ?? clase.aforoMax;
              const confirmadas = reservasConfirmadasDeSesion(reservas, sesion.id).length;
              return (
                <span key={sesion.id} className="flex items-center justify-between text-sm">
                  <span>{clase.horaInicio}</span>
                  <span className="text-muted-foreground">
                    {confirmadas}/{aforo}
                  </span>
                </span>
              );
            })}
          </button>
        );
      })}
    </div>
  );
}
