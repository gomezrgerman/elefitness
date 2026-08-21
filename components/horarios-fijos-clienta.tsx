"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { XIcon } from "lucide-react";
import { quitarHorarioFijo } from "@/lib/actions/horario";
import { AnadirHorarioFijoDialogo } from "./anadir-horario-fijo-dialogo";
import { ORDEN_DIAS } from "@/lib/selectors";
import type { Clase, HorarioFijo, TipoPlan } from "@/lib/types";

interface Props {
  clienteId: string;
  // Ya filtrados a este cliente por quien la llama.
  horariosFijos: HorarioFijo[];
  planTipo: TipoPlan | null;
  clases: Clase[];
  hoy: string;
  puedeEditar: boolean;
}

function etiquetaDia(dia: string): string {
  return dia.charAt(0).toUpperCase() + dia.slice(1);
}

// Una clienta puede tener varias franjas fijas a la vez (ej. lunes,
// miercoles y viernes a las 6:30) -- por eso son chips, no un select unico.
// Solo mensualidades: los bonos quedan fuera del horario fijo a proposito.
export function HorariosFijosClienta({ clienteId, horariosFijos, planTipo, clases, hoy, puedeEditar }: Props) {
  const [anadiendo, setAnadiendo] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [quitandoId, setQuitandoId] = useState<string | null>(null);
  const { toast } = useToast();

  if (planTipo !== "mensual") return null;

  const clasesAsignadas = horariosFijos
    .map((h) => clases.find((c) => c.id === h.claseId))
    .filter((c): c is Clase => Boolean(c))
    .sort((a, b) => ORDEN_DIAS.indexOf(a.dia) - ORDEN_DIAS.indexOf(b.dia) || a.horaInicio.localeCompare(b.horaInicio));

  function quitar(claseId: string) {
    setQuitandoId(claseId);
    startTransition(async () => {
      const respuesta = await quitarHorarioFijo(clienteId, claseId);
      setQuitandoId(null);
      if (respuesta.error) {
        toast(respuesta.error, "error");
        return;
      }
      toast("Horario fijo quitado", "info");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Horarios fijos</p>
        {puedeEditar && (
          <Button variant="outline" size="sm" onClick={() => setAnadiendo(true)}>
            + Añadir
          </Button>
        )}
      </div>

      {clasesAsignadas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin horario fijo asignado.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {clasesAsignadas.map((clase) => (
            <span
              key={clase.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium"
            >
              {etiquetaDia(clase.dia)} {clase.horaInicio}
              {puedeEditar && (
                <button
                  type="button"
                  aria-label={`Quitar ${etiquetaDia(clase.dia)} ${clase.horaInicio}`}
                  disabled={pendiente && quitandoId === clase.id}
                  onClick={() => quitar(clase.id)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <XIcon className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {anadiendo && (
        <AnadirHorarioFijoDialogo
          clienteId={clienteId}
          clases={clases}
          clasesYaAsignadasIds={clasesAsignadas.map((c) => c.id)}
          hoy={hoy}
          onCerrar={() => setAnadiendo(false)}
        />
      )}
    </div>
  );
}
