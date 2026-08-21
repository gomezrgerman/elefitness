"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { usuarioPorId } from "@/lib/selectors";
import { HorarioFijoDialogo } from "./horario-fijo-dialogo";
import type { Clase, Cliente, Usuario, Plan, FranjaHoraria, DiaSemana } from "@/lib/types";

interface Props {
  franjas: FranjaHoraria[];
  clases: Clase[];
  clientes: Cliente[];
  usuarios: Usuario[];
  planes: Plan[];
  puedeEditar: boolean;
}

// Lunes a sabado, igual que RejillaHuecos: el centro no abre domingo.
const DIAS_REJILLA: DiaSemana[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const ETIQUETA_DIA: Record<DiaSemana, string> = {
  lunes: "Lun", martes: "Mar", miercoles: "Mié", jueves: "Jue", viernes: "Vie", sabado: "Sáb", domingo: "Dom",
};

const ESTILO_HUECO = "bg-muted/40 text-muted-foreground/40";

// Esta clase (mensuales asignadas via clase_habitual_id) esta activa hoy en
// esta franja, independientemente de lo que haya reservado esta semana en
// concreto -- por eso no depende de sesiones ni de fecha.
function contarFijos(clases: Clase[], clientes: Cliente[], claseId: string): number {
  return clientes.filter((c) => c.estado === "activo" && c.claseHabitualId === claseId).length;
}

export function RejillaHorarioFijo({ franjas, clases, clientes, usuarios, planes, puedeEditar }: Props) {
  const [claseSeleccionada, setClaseSeleccionada] = useState<Clase | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-medium">Horario fijo de las clientas</h3>
        <p className="text-xs text-muted-foreground">
          La plantilla de grupos fijos (sustituye al Excel): quien pertenece a cada franja, sin importar quien haya
          reservado esta semana en concreto. Toca una franja para ver el grupo{puedeEditar ? " o añadir/quitar a alguien" : ""}.
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-[3.5rem_repeat(6,1fr)] gap-1">
          <span />
          {DIAS_REJILLA.map((dia) => (
            <span key={dia} className="text-center text-xs font-medium text-muted-foreground">
              {ETIQUETA_DIA[dia]}
            </span>
          ))}

          {franjas.map((franja) => (
            <div key={franja.id} className="contents">
              <span className="flex items-center text-[11px] text-muted-foreground tabular-nums">{franja.horaInicio}</span>
              {DIAS_REJILLA.map((dia) => {
                const claseFija = clases.find((c) => c.recurrente && c.dia === dia && c.horaInicio === franja.horaInicio);

                if (!claseFija) {
                  return (
                    <div key={dia} className={cn("flex items-center justify-center rounded-md px-1 py-1.5", ESTILO_HUECO)}>
                      —
                    </div>
                  );
                }

                const entrenador = usuarioPorId(usuarios, claseFija.entrenadorId);
                const count = contarFijos(clases, clientes, claseFija.id);
                const lleno = count >= claseFija.aforoMax;

                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => setClaseSeleccionada(claseFija)}
                    title={`${entrenador?.nombre ?? "Sin entrenador"} · ${count}/${claseFija.aforoMax} fijas`}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-center text-[11px] ring-1 transition-colors",
                      lleno
                        ? "bg-card text-foreground ring-foreground/10 hover:ring-primary/30"
                        : "bg-emerald-950/30 text-emerald-300 ring-emerald-800/40 hover:ring-emerald-600/60"
                    )}
                  >
                    <span>{entrenador?.nombre.split(" ")[0] ?? "—"}</span>
                    <span className="tabular-nums opacity-90">{count}/{claseFija.aforoMax}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-emerald-950/30 ring-1 ring-emerald-800/40" /> Queda hueco fijo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-card ring-1 ring-foreground/10" /> Grupo fijo completo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-muted" /> Sin clase fija aquí
        </span>
      </div>

      {claseSeleccionada && (
        <HorarioFijoDialogo
          clase={claseSeleccionada}
          entrenador={usuarioPorId(usuarios, claseSeleccionada.entrenadorId)}
          clientes={clientes}
          usuarios={usuarios}
          planes={planes}
          puedeEditar={puedeEditar}
          onCerrar={() => setClaseSeleccionada(null)}
        />
      )}
    </div>
  );
}
