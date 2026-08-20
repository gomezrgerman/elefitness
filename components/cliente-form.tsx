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
import type { Cliente, Usuario, Plan, Pago, MetodoPago } from "@/lib/types";

// Base UI Select no admite value="" para representar "sin seleccion", asi
// que usamos este centinela para la opcion "Cualquiera" y lo traducimos a
// null (sin restriccion de entrenador) justo antes de validar.
const CUALQUIER_ENTRENADOR = "cualquiera";

// Mismo motivo: centinela para "sin plan asignado" (clienta "en el aire",
// sin cobro activo), que se traduce a null antes de validar.
const SIN_PLAN = "sin-plan";

const METODOS: { value: MetodoPago; label: string }[] = [
  { value: "stripe", label: "Stripe" },
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
];

interface Props {
  modo: "crear" | "editar";
  cliente?: Cliente;
  usuario?: Usuario;
  // Pago actual de la clienta (solo en modo "editar"): sirve para no
  // sobreescribir con el precio de catalogo un importe o metodo que Elena ya
  // habia corregido a mano (cuota personalizada, pago parcial, etc.).
  pago?: Pago;
  usuarios: Usuario[];
  planes: Plan[];
  onCerrar: () => void;
}

export function ClienteForm({ modo, cliente, usuario, pago, usuarios, planes, onCerrar }: Props) {
  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [telefono, setTelefono] = useState(usuario?.telefono ?? "");
  // OJO: cliente?.planId puede ser null explicitamente (clienta "en el
  // aire") en modo editar, y eso es distinto de "no hay cliente" (modo
  // crear, donde toca sugerir el primer plan). ?? por si solo no distingue
  // ambos casos porque trata null y undefined igual.
  const [planId, setPlanId] = useState(
    modo === "editar" ? cliente?.planId ?? SIN_PLAN : planes[0]?.id ?? SIN_PLAN
  );
  const planInicial = planes.find((p) => p.id === (modo === "editar" ? cliente?.planId : planes[0]?.id));
  const [importe, setImporte] = useState(String(pago?.importe ?? planInicial?.precio ?? ""));
  const [metodo, setMetodo] = useState<MetodoPago>(pago?.metodo ?? (planInicial?.tipo === "bono" ? "efectivo" : "stripe"));
  const sinPlan = planId === SIN_PLAN;
  const [notasRutina, setNotasRutina] = useState(cliente?.notasRutina ?? "");
  const [diasSemanaHabituales, setDiasSemanaHabituales] = useState(String(cliente?.diasSemanaHabituales ?? 1));
  const [entrenadorId, setEntrenadorId] = useState(cliente?.entrenadorRestringidoId ?? CUALQUIER_ENTRENADOR);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const entrenadores = usuarios.filter((u) => u.rol === "entrenador" || u.rol === "admin");
  // Un plan retirado (precio antiguo) no se ofrece en altas nuevas, pero si
  // la clienta ya lo tenia tiene que seguir viendolo en su propio desplegable
  // al editarla -- si no, el Select se queda sin la opcion que ya tenia.
  const planesDisponibles = planes.filter((plan) => plan.activo || plan.id === cliente?.planId);

  // Al elegir un plan distinto en el alta se sugiere su precio y un metodo
  // razonable, pero siguen siendo editables -- hace falta para "Cuota
  // personalizada" (precio de catalogo 0, Elena escribe el real) y para
  // clientas que pagan un plan normal por un medio distinto al habitual.
  function cambiarPlan(nuevoPlanId: string) {
    setPlanId(nuevoPlanId);
    if (modo !== "crear") return;
    const plan = planes.find((p) => p.id === nuevoPlanId);
    if (!plan) return;
    setImporte(plan.precio > 0 ? String(plan.precio) : "");
    setMetodo(plan.tipo === "bono" ? "efectivo" : "stripe");
  }

  async function guardar() {
    const resultado = clienteFormSchema.safeParse({
      nombre,
      email,
      telefono,
      planId: sinPlan ? null : planId,
      importe: sinPlan ? undefined : importe,
      metodo: sinPlan ? undefined : metodo,
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
            importe: resultado.data.importe,
            metodo: resultado.data.metodo,
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
            <Select value={planId} onValueChange={(valor) => valor && cambiarPlan(valor)}>
              <SelectTrigger id="plan">
                <SelectValue placeholder="Selecciona un plan">
                  {(valor: string) =>
                    valor === SIN_PLAN
                      ? "Sin plan (de baja)"
                      : planesDisponibles.find((plan) => plan.id === valor)?.nombre ?? "Selecciona un plan"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_PLAN}>Sin plan (de baja)</SelectItem>
                {planesDisponibles.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!sinPlan && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="importe">Importe (EUR)</Label>
                <Input
                  id="importe"
                  type="number"
                  min={0}
                  step="0.01"
                  value={importe}
                  onChange={(e) => setImporte(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="metodo">Metodo de pago</Label>
                <Select value={metodo} onValueChange={(valor) => valor && setMetodo(valor as MetodoPago)}>
                  <SelectTrigger id="metodo">
                    <SelectValue placeholder="Metodo">
                      {(valor: string) => METODOS.find((m) => m.value === valor)?.label ?? "Metodo"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {METODOS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
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
