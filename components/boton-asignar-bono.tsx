"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AsignarBonoDialogo } from "./asignar-bono-dialogo";
import type { Plan } from "@/lib/types";

interface Props {
  clienteId: string;
  planesBono: Plan[];
  hoy: string;
}

export function BotonAsignarBono({ clienteId, planesBono, hoy }: Props) {
  const [abierto, setAbierto] = useState(false);

  if (planesBono.length === 0) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAbierto(true)}>
        Asignar bono
      </Button>
      {abierto && (
        <AsignarBonoDialogo clienteId={clienteId} planesBono={planesBono} hoy={hoy} onCerrar={() => setAbierto(false)} />
      )}
    </>
  );
}
