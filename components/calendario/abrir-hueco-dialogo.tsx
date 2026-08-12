"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatearDiaLargo, numeroDeDia } from "@/lib/fechas";
import { abrirHueco } from "@/lib/actions/sesiones";
import type { DiaSemana, Usuario } from "@/lib/types";

interface Props {
  dia: DiaSemana;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  usuarios: Usuario[];
  onCerrar: () => void;
}

export function AbrirHuecoDialogo({ dia, fecha, horaInicio, horaFin, usuarios, onCerrar }: Props) {
  const entrenadores = usuarios.filter((u) => u.rol === "entrenador" || u.rol === "admin");

  // Recurrente por defecto en false: si Elena no toca nada, la accion mas
  // segura es la que no le cambia el horario de las semanas siguientes.
  const [recurrente, setRecurrente] = useState(false);
  const [aforo, setAforo] = useState("5");
  const [entrenadorId, setEntrenadorId] = useState(
    entrenadores.find((u) => u.rol === "entrenador")?.id ?? entrenadores[0]?.id ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    setError(null);
    const aforoNumero = Number(aforo);
    if (!Number.isInteger(aforoNumero) || aforoNumero < 1) {
      setError("Las plazas deben ser un numero entero de al menos 1");
      return;
    }
    if (!entrenadorId) {
      setError("Selecciona un entrenador");
      return;
    }
    startTransition(async () => {
      const respuesta = await abrirHueco({
        dia,
        horaInicio,
        horaFin,
        fecha,
        aforo: aforoNumero,
        entrenadorId,
        recurrente,
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
          <DialogTitle>
            Abrir hueco de {horaInicio} a {horaFin}
          </DialogTitle>
          <DialogDescription>{formatearDiaLargo(fecha)}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setRecurrente(false)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                !recurrente ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-input hover:bg-muted"
              )}
            >
              <span className="text-sm font-medium">
                Solo el {dia} {numeroDeDia(fecha)}
              </span>
              <span className="text-xs text-muted-foreground">
                Se abre unicamente para este dia. La semana que viene el hueco vuelve a estar libre.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRecurrente(true)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                recurrente ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-input hover:bg-muted"
              )}
            >
              <span className="text-sm font-medium">Todos los {dia}, a partir de ahora</span>
              <span className="text-xs text-muted-foreground">
                Se anade al horario fijo. Se repite cada semana hasta que lo cambies.
              </span>
            </button>
          </div>

          <div>
            <Label htmlFor="aforo">Plazas</Label>
            <Input id="aforo" type="number" min={1} value={aforo} onChange={(e) => setAforo(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="entrenador">Entrenador</Label>
            <Select value={entrenadorId} onValueChange={(valor) => valor && setEntrenadorId(valor)}>
              <SelectTrigger id="entrenador" className="w-full">
                <SelectValue placeholder="Selecciona un entrenador">
                  {(valor: string) => entrenadores.find((u) => u.id === valor)?.nombre ?? "Selecciona un entrenador"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {entrenadores.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={pendiente}>
            {recurrente ? "Anadir al horario fijo" : "Abrir solo este dia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
