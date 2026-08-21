"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { moverHorarioCliente } from "@/lib/actions/horario";
import { ORDEN_DIAS } from "@/lib/selectors";
import type { Clase } from "@/lib/types";

interface Props {
  clienteId: string;
  clases: Clase[];
  clasesYaAsignadasIds: string[];
  hoy: string;
  onCerrar: () => void;
}

function etiquetaClase(clase: Clase): string {
  const dia = clase.dia.charAt(0).toUpperCase() + clase.dia.slice(1);
  return `${dia} ${clase.horaInicio}–${clase.horaFin}`;
}

// Siempre "solo añadir" (claseOrigenId null, marcarFijo true): suma una
// franja mas al conjunto de horarios fijos de la clienta sin tocar las que
// ya tenia. Para mover/reemplazar una existente esta "Cambiar horario".
export function AnadirHorarioFijoDialogo({ clienteId, clases, clasesYaAsignadasIds, hoy, onCerrar }: Props) {
  const disponibles = clases
    .filter((c) => c.recurrente && !clasesYaAsignadasIds.includes(c.id))
    .sort((a, b) => ORDEN_DIAS.indexOf(a.dia) - ORDEN_DIAS.indexOf(b.dia) || a.horaInicio.localeCompare(b.horaInicio));

  const [claseId, setClaseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const { toast } = useToast();

  function confirmar() {
    setError(null);
    if (!claseId) {
      setError("Selecciona un horario");
      return;
    }
    startTransition(async () => {
      const respuesta = await moverHorarioCliente({
        clienteId,
        claseOrigenId: null,
        claseDestinoId: claseId,
        desde: hoy,
        marcarFijo: true,
      });
      if (respuesta.error) {
        setError(respuesta.error);
        return;
      }
      toast("Horario fijo añadido", "success");
      onCerrar();
    });
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir horario fijo</DialogTitle>
          <DialogDescription>
            Se reserva ya en las sesiones futuras que existan de esta franja, y a partir de ahora se reservará sola cada
            semana, sin tocar el resto de sus horarios fijos.
          </DialogDescription>
        </DialogHeader>

        <Select value={claseId} onValueChange={(valor) => valor && setClaseId(valor)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona un horario">
              {(valor: string) => {
                const clase = disponibles.find((c) => c.id === valor);
                return clase ? etiquetaClase(clase) : "Selecciona un horario";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {disponibles.map((clase) => (
              <SelectItem key={clase.id} value={clase.id}>
                {etiquetaClase(clase)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={pendiente}>
            Añadir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
