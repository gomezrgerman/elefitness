"use client";

import { cn } from "@/lib/utils";
import { reservasConfirmadasDeSesion } from "@/lib/selectors";
import { diasDeMes, huecosIniciales, numeroDeDia } from "@/lib/fechas";
import { colorCeldaOcupacion } from "./color-ocupacion";
import type { Clase, Sesion, Reserva } from "@/lib/types";

interface Props {
  fecha: string;
  hoy: string;
  clases: Clase[];
  sesiones: Sesion[];
  reservas: Reserva[];
  onIrADia: (fecha: string) => void;
}

const CABECERAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function VistaMes({ fecha, hoy, clases, sesiones, reservas, onIrADia }: Props) {
  const dias = diasDeMes(fecha);
  const huecos = huecosIniciales(fecha);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {CABECERAS.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: huecos }, (_, i) => (
          <span key={`hueco-${i}`} />
        ))}
        {dias.map((dia, idx) => {
          const delDia = sesiones
            .filter((s) => s.fecha === dia)
            .map((s) => ({ sesion: s, clase: clases.find((c) => c.id === s.claseId) }))
            .filter((x): x is { sesion: Sesion; clase: Clase } => Boolean(x.clase));

          const apuntados = delDia.reduce((total, { sesion }) => total + reservasConfirmadasDeSesion(reservas, sesion.id).length, 0);
          const aforo = delDia.reduce((total, { sesion, clase }) => total + (sesion.aforoEfectivo ?? clase.aforoMax), 0);

          return (
            <button
              key={dia}
              type="button"
              onClick={() => onIrADia(dia)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl bg-card text-sm ring-1 ring-foreground/10 opacity-0 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:ring-primary/30",
                `animate-stagger-${Math.min(idx + 1, 10)}`,
                colorCeldaOcupacion(apuntados, aforo),
                dia === hoy && "ring-primary/50"
              )}
              style={{ animation: "fade-in-up 0.4s var(--ease-spring) forwards" }}
            >
              <span className={delDia.length === 0 ? "text-muted-foreground" : "font-medium"}>{numeroDeDia(dia)}</span>
              {delDia.length > 0 && <span className="text-xs text-muted-foreground tabular-nums">{apuntados}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
