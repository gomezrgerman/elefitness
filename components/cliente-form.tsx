"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clienteFormSchema } from "@/lib/validaciones";
import { altaCliente, actualizarCliente } from "@/lib/actions/clientes";
import type { Cliente, Usuario, Plan } from "@/lib/types";

// Base UI Select no admite value="" para representar "sin seleccion", asi
// que usamos este centinela para la opcion "Cualquiera" y lo traducimos a
// null (sin restriccion de entrenador) justo antes de validar.
const CUALQUIER_ENTRENADOR = "cualquiera";

interface Props {
  modo: "crear" | "editar";
  cliente?: Cliente;
  usuario?: Usuario;
  usuarios: Usuario[];
  planes: Plan[];
  onCerrar: () => void;
}

export function ClienteForm({ modo, cliente, usuario, usuarios, planes, onCerrar }: Props) {
  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [telefono, setTelefono] = useState(usuario?.telefono ?? "");
  const [planId, setPlanId] = useState(cliente?.planId ?? planes[0]?.id ?? "");
  const [notasRutina, setNotasRutina] = useState(cliente?.notasRutina ?? "");
  const [diasSemanaHabituales, setDiasSemanaHabituales] = useState(String(cliente?.diasSemanaHabituales ?? 1));
  const [entrenadorId, setEntrenadorId] = useState(cliente?.entrenadorRestringidoId ?? CUALQUIER_ENTRENADOR);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const entrenadores = usuarios.filter((u) => u.rol === "entrenador" || u.rol === "admin");

  async function guardar() {
    const resultado = clienteFormSchema.safeParse({
      nombre,
      email,
      telefono,
      planId,
      notasRutina,
      diasSemanaHabituales,
      entrenadorRestringidoId: entrenadorId === CUALQUIER_ENTRENADOR ? null : entrenadorId,
    });
    if (!resultado.success) {
      setError(resultado.error.issues[0]?.message ?? "Datos invalidos");
      return;
    }
    setGuardando(true);
    const respuesta =
      modo === "crear"
        ? await altaCliente(resultado.data)
        : await actualizarCliente(cliente!.id, {
            planId: resultado.data.planId,
            notasRutina: resultado.data.notasRutina,
            diasSemanaHabituales: resultado.data.diasSemanaHabituales,
            entrenadorRestringidoId: resultado.data.entrenadorRestringidoId,
          });
    setGuardando(false);
    if (respuesta.error) {
      setError(respuesta.error);
      return;
    }
    onCerrar();
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{modo === "crear" ? "Nueva clienta" : "Editar clienta"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" value={nombre} disabled={modo === "editar"} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled={modo === "editar"} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="telefono">Telefono</Label>
            <Input id="telefono" value={telefono} disabled={modo === "editar"} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="plan">Plan</Label>
            <Select value={planId} onValueChange={(valor) => valor && setPlanId(valor)}>
              <SelectTrigger id="plan">
                <SelectValue placeholder="Selecciona un plan">
                  {(valor: string) => planes.find((plan) => plan.id === valor)?.nombre ?? "Selecciona un plan"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {planes.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="dias-semana">Dias por semana que entrena</Label>
            <Input
              id="dias-semana"
              type="number"
              min={1}
              max={7}
              value={diasSemanaHabituales}
              onChange={(e) => setDiasSemanaHabituales(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="entrenador">Entrena con</Label>
            <Select value={entrenadorId} onValueChange={(valor) => valor && setEntrenadorId(valor)}>
              <SelectTrigger id="entrenador">
                <SelectValue placeholder="Cualquiera">
                  {(valor: string) =>
                    valor === CUALQUIER_ENTRENADOR
                      ? "Cualquiera"
                      : usuarios.find((u) => u.id === valor)?.nombre ?? "Cualquiera"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CUALQUIER_ENTRENADOR}>Cualquiera</SelectItem>
                {entrenadores.map((entrenador) => (
                  <SelectItem key={entrenador.id} value={entrenador.id}>
                    {entrenador.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="notas">Notas de rutina</Label>
            <Textarea id="notas" value={notasRutina} onChange={(e) => setNotasRutina(e.target.value)} rows={4} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
