"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { moverHorarioCliente } from "@/lib/actions/horario";
import { usuarioPorId, ORDEN_DIAS } from "@/lib/selectors";
import type { Clase, Usuario, TipoPlan } from "@/lib/types";

const SIN_ORIGEN = "sin-origen";

interface Props {
  clienteId: string;
  // Ids de las clases en las que ya tiene horario fijo hoy -- el desplegable
  // de "horario actual" solo tiene sentido mostrar estas, no las 50+ clases
  // del centro (una clienta puede tener varias, ver migracion 0023).
  horariosFijosIds: string[];
  planTipo: TipoPlan | null;
  clases: Clase[];
  usuarios: Usuario[];
  hoy: string;
  onCerrar: () => void;
}

// clase puede no encontrarse: el render prop de SelectValue se invoca
// tambien con el valor inicial (SIN_ORIGEN, o "" antes de elegir destino),
// que no corresponde a ninguna clase real.
function etiquetaClase(clase: Clase | undefined, usuarios: Usuario[]): string | undefined {
  if (!clase) return undefined;
  const dia = clase.dia.charAt(0).toUpperCase() + clase.dia.slice(1);
  const entrenador = usuarioPorId(usuarios, clase.entrenadorId);
  return `${dia} ${clase.horaInicio}–${clase.horaFin}${entrenador ? ` · ${entrenador.nombre}` : ""}`;
}

export function CambiarHorarioDialogo({ clienteId, horariosFijosIds, planTipo, clases, usuarios, hoy, onCerrar }: Props) {
  const [claseOrigenId, setClaseOrigenId] = useState(SIN_ORIGEN);
  const [claseDestinoId, setClaseDestinoId] = useState("");
  const [desde, setDesde] = useState(hoy);
  const [marcarFijo, setMarcarFijo] = useState(planTipo === "mensual");
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const clasesRecurrentes = clases
    .filter((c) => c.recurrente)
    .sort((a, b) => ORDEN_DIAS.indexOf(a.dia) - ORDEN_DIAS.indexOf(b.dia) || a.horaInicio.localeCompare(b.horaInicio));
  // Solo tiene sentido "mover desde" uno de los horarios fijos que ya tiene
  // -- listar las 50+ clases del centro aqui confundiria mas que ayudaria.
  const clasesOrigenPosibles = clasesRecurrentes.filter((c) => horariosFijosIds.includes(c.id));

  function confirmar() {
    setError(null);
    setResultado(null);
    if (!claseDestinoId) {
      setError("Selecciona el horario nuevo");
      return;
    }
    startTransition(async () => {
      const respuesta = await moverHorarioCliente({
        clienteId,
        claseOrigenId: claseOrigenId === SIN_ORIGEN ? null : claseOrigenId,
        claseDestinoId,
        desde,
        marcarFijo,
      });
      if (respuesta.error) {
        setError(respuesta.error);
        return;
      }
      setResultado(
        `Movida a ${respuesta.sesionesMovidas ?? 0} sesion(es) ya existentes` +
          (marcarFijo ? ". A partir de ahora se reserva sola cada semana." : ".")
      );
    });
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar horario</DialogTitle>
          <DialogDescription>
            Mueve sus reservas futuras ya existentes de un horario a otro, sin penalizarla (se le devuelve el credito de
            bono si lo habia gastado).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="clase-origen">Horario actual</Label>
            <Select value={claseOrigenId} onValueChange={(valor) => valor && setClaseOrigenId(valor)}>
              <SelectTrigger id="clase-origen" className="w-full">
                <SelectValue placeholder="Ninguno">
                  {(valor: string) =>
                    valor === SIN_ORIGEN
                      ? "Ninguno (solo añadir al nuevo)"
                      : etiquetaClase(clasesOrigenPosibles.find((c) => c.id === valor), usuarios) ??
                        "Ninguno (solo añadir al nuevo)"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_ORIGEN}>Ninguno (solo añadir al nuevo)</SelectItem>
                {clasesOrigenPosibles.map((clase) => (
                  <SelectItem key={clase.id} value={clase.id}>
                    {etiquetaClase(clase, usuarios)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="clase-destino">Horario nuevo</Label>
            <Select value={claseDestinoId} onValueChange={(valor) => valor && setClaseDestinoId(valor)}>
              <SelectTrigger id="clase-destino" className="w-full">
                <SelectValue placeholder="Selecciona el horario nuevo">
                  {(valor: string) =>
                    etiquetaClase(clasesRecurrentes.find((c) => c.id === valor), usuarios) ?? "Selecciona el horario nuevo"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {clasesRecurrentes.map((clase) => (
                  <SelectItem key={clase.id} value={clase.id}>
                    {etiquetaClase(clase, usuarios)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="desde">A partir de</Label>
            <Input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>

          {planTipo === "mensual" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={marcarFijo}
                onChange={(e) => setMarcarFijo(e.target.checked)}
                className="size-4"
              />
              Este es su horario fijo a partir de ahora (se reserva sola cada semana)
            </label>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {resultado && <p className="text-sm text-green-700">{resultado}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={pendiente}>
            Cerrar
          </Button>
          <Button onClick={confirmar} disabled={pendiente}>
            Mover horario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
