"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { planPorId, usuarioPorId } from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";
import { ClienteForm } from "./cliente-form";
import { bajaCliente, reactivarCliente } from "@/lib/actions/clientes";
import type { Cliente, Usuario, Plan } from "@/lib/types";

interface Props {
  clientes: Cliente[];
  usuarios: Usuario[];
  planes: Plan[];
  basePath: string;
  soloLectura?: boolean;
}

export function ListaClientes({ clientes, usuarios, planes, basePath, soloLectura = false }: Props) {
  const [clienteEnEdicion, setClienteEnEdicion] = useState<Cliente | null>(null);
  const [creando, setCreando] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function darDeBaja(clienteId: string) {
    setError(null);
    startTransition(async () => {
      const respuesta = await bajaCliente(clienteId);
      if (respuesta.error) setError(respuesta.error);
    });
  }

  function reactivar(clienteId: string) {
    setError(null);
    startTransition(async () => {
      const respuesta = await reactivarCliente(clienteId);
      if (respuesta.error) setError(respuesta.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
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
                <TableCell className="font-medium">
                  <Link href={`${basePath}/${cliente.id}`} className="hover:underline">
                    {usuario.nombre}
                  </Link>
                </TableCell>
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
                        <Button variant="destructive" size="sm" disabled={pendiente} onClick={() => darDeBaja(cliente.id)}>
                          Dar de baja
                        </Button>
                      ) : (
                        <Button variant="secondary" size="sm" disabled={pendiente} onClick={() => reactivar(cliente.id)}>
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

      {creando && <ClienteForm modo="crear" planes={planes} onCerrar={() => setCreando(false)} />}
      {clienteEnEdicion && (
        <ClienteForm
          modo="editar"
          cliente={clienteEnEdicion}
          usuario={usuarioPorId(usuarios, clienteEnEdicion.usuarioId)}
          planes={planes}
          onCerrar={() => setClienteEnEdicion(null)}
        />
      )}
    </div>
  );
}
