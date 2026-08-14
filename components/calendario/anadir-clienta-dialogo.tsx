"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reservarSesion } from "@/lib/actions/reservas";
import { usuarioPorId } from "@/lib/selectors";
import type { Cliente, Usuario } from "@/lib/types";

interface Props {
  sesionId: string;
  clientesDisponibles: Cliente[];
  usuarios: Usuario[];
  onCerrar: () => void;
}

// Con esto Elena resuelve "mover" una reserva sin ningun boton dedicado:
// cancela en un grupo (ya existia) y aqui la vuelve a apuntar en otro.
export function AnadirClientaDialogo({ sesionId, clientesDisponibles, usuarios, onCerrar }: Props) {
  const [clienteId, setClienteId] = useState(clientesDisponibles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    setError(null);
    if (!clienteId) {
      setError("Selecciona una clienta");
      return;
    }
    startTransition(async () => {
      const respuesta = await reservarSesion(sesionId, clienteId);
      if (respuesta.error) {
        setError(respuesta.error);
        return;
      }
      onCerrar();
    });
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir clienta a esta clase</DialogTitle>
          <DialogDescription>
            Si hay hueco queda confirmada; si no, entra en lista de espera. Descuenta credito de bono igual que si
            reservara ella misma.
          </DialogDescription>
        </DialogHeader>

        {clientesDisponibles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay clientas disponibles para apuntar aqui.</p>
        ) : (
          <Select value={clienteId} onValueChange={(valor) => valor && setClienteId(valor)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona una clienta">
                {(valor: string) => usuarioPorId(usuarios, clientesDisponibles.find((c) => c.id === valor)?.usuarioId ?? "")?.nombre ?? "Selecciona una clienta"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {clientesDisponibles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {usuarioPorId(usuarios, c.usuarioId)?.nombre ?? "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={pendiente || clientesDisponibles.length === 0}>
            Añadir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
