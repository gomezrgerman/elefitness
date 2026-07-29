"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/lib/mock-store";
import { usuarioPorId } from "@/lib/selectors";
import { clienteFormSchema } from "@/lib/validaciones";
import type { Cliente } from "@/lib/types";

interface Props {
  modo: "crear" | "editar";
  cliente?: Cliente;
  onCerrar: () => void;
}

export function ClienteForm({ modo, cliente, onCerrar }: Props) {
  const { planes, usuarios, altaCliente, actualizarCliente } = useAppStore();
  const usuarioActual = cliente ? usuarioPorId(usuarios, cliente.usuarioId) : undefined;

  const [nombre, setNombre] = useState(usuarioActual?.nombre ?? "");
  const [email, setEmail] = useState(usuarioActual?.email ?? "");
  const [telefono, setTelefono] = useState(usuarioActual?.telefono ?? "");
  const [planId, setPlanId] = useState(cliente?.planId ?? planes[0]?.id ?? "");
  const [notasRutina, setNotasRutina] = useState(cliente?.notasRutina ?? "");
  const [error, setError] = useState<string | null>(null);

  function guardar() {
    const resultado = clienteFormSchema.safeParse({ nombre, email, telefono, planId, notasRutina });
    if (!resultado.success) {
      setError(resultado.error.issues[0]?.message ?? "Datos invalidos");
      return;
    }
    if (modo === "crear") {
      altaCliente(resultado.data);
    } else if (cliente) {
      actualizarCliente(cliente.id, { planId: resultado.data.planId, notasRutina: resultado.data.notasRutina });
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
                <SelectValue placeholder="Selecciona un plan" />
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
            <Label htmlFor="notas">Notas de rutina</Label>
            <Textarea id="notas" value={notasRutina} onChange={(e) => setNotasRutina(e.target.value)} rows={4} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={guardar}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
