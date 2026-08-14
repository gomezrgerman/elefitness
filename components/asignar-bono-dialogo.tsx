"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sumarMesesMismoDia } from "@/lib/fechas";
import { crearBono } from "@/lib/actions/bonos";
import type { Plan } from "@/lib/types";

interface Props {
  clienteId: string;
  planesBono: Plan[];
  hoy: string;
  onCerrar: () => void;
}

export function AsignarBonoDialogo({ clienteId, planesBono, hoy, onCerrar }: Props) {
  const [planId, setPlanId] = useState(planesBono[0]?.id ?? "");
  const [creditos, setCreditos] = useState(String(planesBono[0]?.clasesIncluidas ?? 10));
  const [fechaCompra] = useState(hoy);
  // Precargada con el mismo calculo que hace crear_bono cuando no se le pasa
  // nada (+3 meses, mismo dia): Elena la ve y la cambia solo si quiere una
  // caducidad distinta, en vez de tener que calcularla ella misma.
  const [fechaCaducidad, setFechaCaducidad] = useState(sumarMesesMismoDia(hoy, 3));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    setError(null);
    const creditosNumero = Number(creditos);
    if (!Number.isInteger(creditosNumero) || creditosNumero < 1) {
      setError("Los creditos deben ser un numero entero de al menos 1");
      return;
    }
    if (!planId) {
      setError("Selecciona un plan de bono");
      return;
    }
    startTransition(async () => {
      const respuesta = await crearBono({
        clienteId,
        planId,
        creditosTotales: creditosNumero,
        fechaCompra,
        fechaCaducidad,
      });
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
          <DialogTitle>Asignar un bono</DialogTitle>
          <DialogDescription>Se suma a los bonos activos de esta clienta, listo para consumir.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="plan-bono">Plan</Label>
            <Select value={planId} onValueChange={(valor) => valor && setPlanId(valor)}>
              <SelectTrigger id="plan-bono" className="w-full">
                <SelectValue placeholder="Selecciona un plan">
                  {(valor: string) => planesBono.find((p) => p.id === valor)?.nombre ?? "Selecciona un plan"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {planesBono.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="creditos">Creditos</Label>
            <Input id="creditos" type="number" min={1} value={creditos} onChange={(e) => setCreditos(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="caducidad">Caduca el</Label>
            <Input
              id="caducidad"
              type="date"
              value={fechaCaducidad}
              onChange={(e) => setFechaCaducidad(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={pendiente}>
            Asignar bono
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
