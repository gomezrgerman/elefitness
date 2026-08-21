"use client";

import { useMemo, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { usuarioPorId, planPorId } from "@/lib/selectors";
import { hoyEnEspana } from "@/lib/fechas";
import { moverHorarioCliente, quitarHorarioFijo } from "@/lib/actions/horario";
import { SearchIcon, XIcon } from "lucide-react";
import type { Clase, Cliente, Usuario, Plan, HorarioFijo } from "@/lib/types";

interface Props {
  clase: Clase;
  entrenador: Usuario | undefined;
  clientes: Cliente[];
  horariosFijos: HorarioFijo[];
  usuarios: Usuario[];
  planes: Plan[];
  puedeEditar: boolean;
  onCerrar: () => void;
}

function etiquetaDia(dia: string): string {
  return dia.charAt(0).toUpperCase() + dia.slice(1);
}

export function HorarioFijoDialogo({ clase, entrenador, clientes, horariosFijos, usuarios, planes, puedeEditar, onCerrar }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [pendiente, startTransition] = useTransition();
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const { toast } = useToast();

  const idsEnEstaFranja = useMemo(
    () => new Set(horariosFijos.filter((h) => h.claseId === clase.id).map((h) => h.clienteId)),
    [horariosFijos, clase.id]
  );

  const fijos = useMemo(
    () => clientes.filter((c) => c.estado === "activo" && idsEnEstaFranja.has(c.id)),
    [clientes, idsEnEstaFranja]
  );

  const resultadosBusqueda = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [];
    return clientes
      .filter((c) => {
        if (c.estado !== "activo" || idsEnEstaFranja.has(c.id)) return false;
        const plan = planPorId(planes, c.planId);
        if (plan?.tipo !== "mensual") return false;
        const usuario = usuarioPorId(usuarios, c.usuarioId);
        return usuario?.nombre.toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [busqueda, clientes, planes, usuarios, idsEnEstaFranja]);

  function quitar(clienteId: string) {
    setProcesandoId(clienteId);
    startTransition(async () => {
      const respuesta = await quitarHorarioFijo(clienteId, clase.id);
      setProcesandoId(null);
      if (respuesta.error) {
        toast(respuesta.error, "error");
        return;
      }
      toast("Fuera del horario fijo", "info");
    });
  }

  function anadir(clienteId: string) {
    setProcesandoId(clienteId);
    startTransition(async () => {
      const respuesta = await moverHorarioCliente({
        clienteId,
        claseOrigenId: null,
        claseDestinoId: clase.id,
        desde: hoyEnEspana(),
        marcarFijo: true,
      });
      setProcesandoId(null);
      if (respuesta.error) {
        toast(respuesta.error, "error");
        return;
      }
      toast("Añadida al horario fijo", "success");
      setBusqueda("");
    });
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {etiquetaDia(clase.dia)} {clase.horaInicio}–{clase.horaFin}
          </DialogTitle>
          <DialogDescription>
            {entrenador?.nombre ?? "Sin entrenador"} · {fijos.length}/{clase.aforoMax} fijas
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {fijos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay nadie fijo en esta franja.</p>
          ) : (
            fijos.map((cliente) => {
              const usuario = usuarioPorId(usuarios, cliente.usuarioId);
              const plan = planPorId(planes, cliente.planId);
              return (
                <div key={cliente.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{usuario?.nombre ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{plan?.nombre ?? "Sin plan"}</p>
                  </div>
                  {puedeEditar && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Quitar del horario fijo"
                      disabled={pendiente && procesandoId === cliente.id}
                      onClick={() => quitar(cliente.id)}
                    >
                      <XIcon className="size-3.5" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {puedeEditar && (
          <div className="flex flex-col gap-2 border-t pt-3">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar clienta para añadir..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8"
              />
            </div>
            {resultadosBusqueda.length > 0 && (
              <div className="flex flex-col gap-1">
                {resultadosBusqueda.map((cliente) => {
                  const usuario = usuarioPorId(usuarios, cliente.usuarioId);
                  return (
                    <button
                      key={cliente.id}
                      type="button"
                      disabled={pendiente && procesandoId === cliente.id}
                      onClick={() => anadir(cliente.id)}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
                    >
                      <span>{usuario?.nombre ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">+ Añadir</span>
                    </button>
                  );
                })}
              </div>
            )}
            {busqueda.trim() && resultadosBusqueda.length === 0 && (
              <p className="px-1 text-xs text-muted-foreground">Sin resultados entre las mensualidades activas.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
