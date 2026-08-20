"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CambiarHorarioDialogo } from "./cambiar-horario-dialogo";
import type { Clase, Usuario, TipoPlan } from "@/lib/types";

interface Props {
  clienteId: string;
  claseHabitualId: string | null;
  planTipo: TipoPlan | null;
  clases: Clase[];
  usuarios: Usuario[];
  hoy: string;
}

export function BotonCambiarHorario({ clienteId, claseHabitualId, planTipo, clases, usuarios, hoy }: Props) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAbierto(true)}>
        Cambiar horario
      </Button>
      {abierto && (
        <CambiarHorarioDialogo
          clienteId={clienteId}
          claseHabitualId={claseHabitualId}
          planTipo={planTipo}
          clases={clases}
          usuarios={usuarios}
          hoy={hoy}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}
