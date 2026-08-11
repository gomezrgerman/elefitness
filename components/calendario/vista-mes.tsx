"use client";

import { reservasConfirmadasDeSesion } from "@/lib/selectors";
import { diasDeMes, huecosIniciales, numeroDeDia } from "@/lib/fechas";
import type { Clase, Sesion, Reserva } from "@/lib/types";

interface Props {
  fecha: string;
  hoy: string;
  clases: Clase[];
  sesiones: Sesion[];
  reservas: Reserva[];
  onIrADia: (fecha: string) => void;
}

const CABECERAS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

// La carga es la ocupacion del dia sobre el aforo total de sus clases. Sirve
// para ver de un vistazo que dias flojean.
function colorDeCarga(apuntados: number, aforo: number): string {
  if (aforo === 0) return "";
  const ratio = apuntados / aforo;
  if (ratio >= 0.85) return "bg-emerald-600/20";
  if (ratio >= 0.4) return "bg-amber-500/20";
  return "bg-red-500/15";
}

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
        {dias.map((dia) => {
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
              className={`flex aspect-square flex-col items-center justify-center rounded-md border text-sm transition hover:bg-muted ${colorDeCarga(
                apuntados,
                aforo
              )} ${dia === hoy ? "border-primary" : ""}`}
            >
              <span className={delDia.length === 0 ? "text-muted-foreground" : "font-medium"}>{numeroDeDia(dia)}</span>
              {delDia.length > 0 && <span className="text-xs text-muted-foreground">{apuntados}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
