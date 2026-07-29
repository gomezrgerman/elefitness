"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/mock-store";
import { planPorId, usuarioPorId } from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";
import { ClienteForm } from "./cliente-form";
import type { Cliente } from "@/lib/types";

export function ListaClientes({ soloLectura = false }: { soloLectura?: boolean }) {
  const { clientes, usuarios, planes, bajaCliente, reactivarCliente } = useAppStore();
  const [clienteEnEdicion, setClienteEnEdicion] = useState<Cliente | null>(null);
  const [creando, setCreando] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {!soloLectura && (
        <div className="flex justify-end">
          <Button onClick={() => setCreando(true)}>+ Nueva clienta</Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Notas de rutina</TableHead>
            {!soloLectura && <TableHead className="text-right">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.map((cliente) => {
            const usuario = usuarioPorId(usuarios, cliente.usuarioId);
            const plan = planPorId(planes, cliente.planId);
            if (!usuario) return null;
            return (
              <TableRow key={cliente.id}>
                <TableCell className="font-medium">{usuario.nombre}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {usuario.email}
                  <br />
                  {usuario.telefono}
                </TableCell>
                <TableCell>{plan?.nombre ?? "—"}</TableCell>
                <TableCell>
                  <BadgeEstado estado={cliente.estado} />
                </TableCell>
                <TableCell className="max-w-xs text-sm text-muted-foreground">{cliente.notasRutina || "—"}</TableCell>
                {!soloLectura && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setClienteEnEdicion(cliente)}>
                        Editar
                      </Button>
                      {cliente.estado === "activo" ? (
                        <Button variant="destructive" size="sm" onClick={() => bajaCliente(cliente.id)}>
                          Dar de baja
                        </Button>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => reactivarCliente(cliente.id)}>
                          Reactivar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {creando && <ClienteForm modo="crear" onCerrar={() => setCreando(false)} />}
      {clienteEnEdicion && (
        <ClienteForm modo="editar" cliente={clienteEnEdicion} onCerrar={() => setClienteEnEdicion(null)} />
      )}
    </div>
  );
}
