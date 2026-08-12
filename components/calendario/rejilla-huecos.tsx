"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usuarioPorId } from "@/lib/selectors";
import { diasDeSemana, formatearDiaCorto, formatearRangoSemana, numeroDeDia, sumarDias } from "@/lib/fechas";
import { Button } from "@/components/ui/button";
import { AbrirHuecoDialogo } from "./abrir-hueco-dialogo";
import type { Clase, Sesion, FranjaHoraria, Usuario, DiaSemana } from "@/lib/types";

interface Props {
  hoy: string;
  franjas: FranjaHoraria[];
  clases: Clase[];
  sesiones: Sesion[];
  usuarios: Usuario[];
  puedeAbrir: boolean;
}

// Lunes a sabado: la rejilla del centro no incluye domingo. Mismo orden que
// diasDeSemana(fecha) devuelve, asi que sus primeras 6 fechas se corresponden
// una a una con este array.
const DIAS_REJILLA: DiaSemana[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

interface CeldaSeleccionada {
  dia: DiaSemana;
  fecha: string;
  franja: FranjaHoraria;
}

// Reutiliza el mismo par de tokens amber que BadgeEstado usa para
// "lista_espera" / "pendiente": aqui significa "esto es excepcional, mira dos
// veces antes de asumir que se repite".
const ESTILO_FIJA = "bg-card text-foreground ring-1 ring-foreground/10";
const ESTILO_PUNTUAL = "bg-amber-950/50 text-amber-300 ring-1 ring-amber-800/60";
const ESTILO_HUECO_ABRIBLE =
  "bg-muted/60 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground hover:ring-1 hover:ring-primary/30";
const ESTILO_HUECO_CERRADO = "bg-muted/40 text-muted-foreground/40";

export function RejillaHuecos({ hoy, franjas, clases, sesiones, usuarios, puedeAbrir }: Props) {
  const [fecha, setFecha] = useState(hoy);
  const [celda, setCelda] = useState<CeldaSeleccionada | null>(null);

  const fechasDeLaSemana = diasDeSemana(fecha).slice(0, 6);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Horario del centro</h3>
          <p className="text-xs text-muted-foreground">
            {puedeAbrir ? "Toca un hueco en gris para abrirlo." : "Vista de solo lectura."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setFecha(sumarDias(fecha, -7))} aria-label="Semana anterior">
            ←
          </Button>
          <span className="text-sm text-muted-foreground">{formatearRangoSemana(fecha)}</span>
          <Button variant="outline" size="sm" onClick={() => setFecha(sumarDias(fecha, 7))} aria-label="Semana siguiente">
            →
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-[3.5rem_repeat(6,1fr)] gap-1">
          <span />
          {DIAS_REJILLA.map((dia, idx) => (
            <span
              key={dia}
              className={cn(
                "text-center text-xs font-medium text-muted-foreground",
                fechasDeLaSemana[idx] === hoy && "text-foreground"
              )}
            >
              {formatearDiaCorto(fechasDeLaSemana[idx])} {numeroDeDia(fechasDeLaSemana[idx])}
            </span>
          ))}

          {franjas.map((franja) => (
            <div key={franja.id} className="contents">
              <span className="flex items-center text-[11px] text-muted-foreground tabular-nums">{franja.horaInicio}</span>
              {DIAS_REJILLA.map((dia, idx) => {
                const fechaDia = fechasDeLaSemana[idx];

                const claseFija = clases.find((c) => c.recurrente && c.dia === dia && c.horaInicio === franja.horaInicio);

                const sesionPuntual = !claseFija
                  ? sesiones.find((s) => {
                      if (s.fecha !== fechaDia) return false;
                      const c = clases.find((cl) => cl.id === s.claseId);
                      return Boolean(c && !c.recurrente && c.horaInicio === franja.horaInicio);
                    })
                  : undefined;
                const clasePuntual = sesionPuntual ? clases.find((c) => c.id === sesionPuntual.claseId) : undefined;

                if (claseFija) {
                  const entrenador = usuarioPorId(usuarios, claseFija.entrenadorId);
                  return (
                    <div
                      key={dia}
                      title={`Clase fija, ${entrenador?.nombre ?? "sin entrenador"}`}
                      className={cn("flex items-center justify-center rounded-md px-1 py-1.5 text-center text-[11px]", ESTILO_FIJA)}
                    >
                      {entrenador?.nombre.split(" ")[0] ?? "—"}
                    </div>
                  );
                }

                if (clasePuntual) {
                  const entrenador = usuarioPorId(usuarios, clasePuntual.entrenadorId);
                  return (
                    <div
                      key={dia}
                      title={`Abierta solo este dia, ${entrenador?.nombre ?? "sin entrenador"}`}
                      className={cn("flex flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-center text-[11px]", ESTILO_PUNTUAL)}
                    >
                      <span>{entrenador?.nombre.split(" ")[0] ?? "—"}</span>
                      <span className="text-[9px] uppercase tracking-wide opacity-80">Puntual</span>
                    </div>
                  );
                }

                if (puedeAbrir) {
                  return (
                    <button
                      key={dia}
                      type="button"
                      title="Hueco: toca para abrirlo"
                      onClick={() => setCelda({ dia, fecha: fechaDia, franja })}
                      className={cn("flex items-center justify-center rounded-md px-1 py-1.5", ESTILO_HUECO_ABRIBLE)}
                    >
                      <PlusIcon className="size-3.5" />
                    </button>
                  );
                }

                return (
                  <div key={dia} className={cn("flex items-center justify-center rounded-md px-1 py-1.5", ESTILO_HUECO_CERRADO)}>
                    —
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm", ESTILO_FIJA)} /> Clase fija
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-amber-950/50 ring-1 ring-amber-800/60" /> Abierta puntualmente
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-muted" /> Hueco
        </span>
      </div>

      {celda && (
        <AbrirHuecoDialogo
          dia={celda.dia}
          fecha={celda.fecha}
          horaInicio={celda.franja.horaInicio}
          horaFin={celda.franja.horaFin}
          usuarios={usuarios}
          onCerrar={() => setCelda(null)}
        />
      )}
    </div>
  );
}
