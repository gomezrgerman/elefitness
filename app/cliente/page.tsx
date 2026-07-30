"use client";

import { useAppStore } from "@/lib/mock-store";
import { HorarioCliente } from "@/components/horario-cliente";
import { MiPlan } from "@/components/mi-plan";
import { usuarioPorId } from "@/lib/selectors";

export default function ClientePage() {
  const { sesion, clientes, usuarios } = useAppStore();
  if (!sesion) return null;
  const cliente = clientes.find((c) => c.usuarioId === sesion.usuarioId);
  const usuario = usuarioPorId(usuarios, sesion.usuarioId);
  if (!cliente || !usuario) return null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Hola, {usuario.nombre}</h1>
      <MiPlan clienteId={cliente.id} />
      <div>
        <h2 className="mb-3 text-lg font-medium">Horario semanal</h2>
        <HorarioCliente clienteId={cliente.id} />
      </div>
    </div>
  );
}
