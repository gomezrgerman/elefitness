"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { planPorId, usuarioPorId, pagoDeCliente } from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";
import { ClienteForm } from "./cliente-form";
import { bajaCliente, reactivarCliente } from "@/lib/actions/clientes";
import { cn } from "@/lib/utils";
import { SearchIcon } from "lucide-react";
import type { Cliente, Usuario, Plan, Pago } from "@/lib/types";

interface Props {
  clientes: Cliente[];
  usuarios: Usuario[];
  planes: Plan[];
  // Solo hace falta para el formulario de edicion (prefill de importe/metodo
  // reales); el panel de solo lectura del entrenador nunca lo abre.
  pagos?: Pago[];
  basePath: string;
  soloLectura?: boolean;
}

export function ListaClientes({ clientes, usuarios, planes, pagos = [], basePath, soloLectura = false }: Props) {
  const [clienteEnEdicion, setClienteEnEdicion] = useState<Cliente | null>(null);
  const [creando, setCreando] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  // Con el volumen real de clientas (activas + las "en el aire" que Elena
  // quiere tener a mano sin mezclarlas con las que entrenan), separar por
  // pestana evita que la tabla sea una lista interminable por defecto.
  const [vista, setVista] = useState<"activas" | "inactivas">("activas");
  const { toast } = useToast();

  const activas = useMemo(() => clientes.filter((c) => c.estado === "activo"), [clientes]);
  const inactivas = useMemo(() => clientes.filter((c) => c.estado === "baja"), [clientes]);

  const filtrados = useMemo(() => {
    const base = vista === "activas" ? activas : inactivas;
    if (!busqueda.trim()) return base;
    const q = busqueda.toLowerCase();
    return base.filter((c) => {
      const u = usuarioPorId(usuarios, c.usuarioId);
      const p = planPorId(planes, c.planId);
      return (
        u?.nombre?.toLowerCase().includes(q) ||
        u?.email?.toLowerCase().includes(q) ||
        p?.nombre?.toLowerCase().includes(q) ||
        c.notasRutina?.toLowerCase().includes(q)
      );
    });
  }, [activas, inactivas, vista, usuarios, planes, busqueda]);

  function darDeBaja(clienteId: string) {
    setError(null);
    startTransition(async () => {
      const respuesta = await bajaCliente(clienteId);
      if (respuesta.error) {
        setError(respuesta.error);
        toast(respuesta.error, "error");
      } else {
        toast("Clienta dada de baja", "info");
      }
    });
  }

  function reactivar(clienteId: string) {
    setError(null);
    startTransition(async () => {
      const respuesta = await reactivarCliente(clienteId);
      if (respuesta.error) {
        setError(respuesta.error);
        toast(respuesta.error, "error");
      } else {
        toast("Clienta reactivada", "success");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border p-0.5">
          <button
            type="button"
            onClick={() => setVista("activas")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              vista === "activas" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Activas ({activas.length})
          </button>
          <button
            type="button"
            onClick={() => setVista("inactivas")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              vista === "inactivas" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Inactivas ({inactivas.length})
          </button>
        </div>
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar clienta..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8"
          />
        </div>
        {!soloLectura && (
          <Button onClick={() => setCreando(true)}>+ Nueva clienta</Button>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead className="hidden sm:table-cell">Contacto</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="hidden lg:table-cell">Notas de rutina</TableHead>
            {!soloLectura && <TableHead className="text-right">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrados.map((cliente, idx) => {
            const usuario = usuarioPorId(usuarios, cliente.usuarioId);
            const plan = planPorId(planes, cliente.planId);
            if (!usuario) return null;
            return (
              <TableRow
                key={cliente.id}
                className={cn(
                  "opacity-0",
                  `animate-stagger-${Math.min(idx + 1, 10)}`,
                  // Clienta "en el aire" (sin plan, sin cobro activo): se ve
                  // atenuada para no competir visualmente con las que si
                  // estan pagando, pero sigue siendo accesible igual.
                  !cliente.planId && "text-muted-foreground/70"
                )}
                style={{ animation: "fade-in-up 0.4s var(--ease-spring) forwards" }}
              >
                <TableCell className="font-medium">
                  <Link href={`${basePath}/${cliente.id}`} className="hover:underline">
                    {usuario.nombre}
                  </Link>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                  {usuario.email}
                  <br />
                  {usuario.telefono}
                </TableCell>
                <TableCell>{plan?.nombre ?? "Sin plan"}</TableCell>
                <TableCell>
                  <BadgeEstado estado={cliente.estado} />
                </TableCell>
                <TableCell className="hidden lg:table-cell max-w-[200px] text-sm text-muted-foreground">
                  <span className="line-clamp-2 whitespace-normal" title={cliente.notasRutina || undefined}>
                    {cliente.notasRutina || "—"}
                  </span>
                </TableCell>
                {!soloLectura && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setClienteEnEdicion(cliente)}>
                        Editar
                      </Button>
                      {cliente.estado === "activo" ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={pendiente}
                          onClick={() => darDeBaja(cliente.id)}
                        >
                          Dar de baja
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={pendiente}
                          onClick={() => reactivar(cliente.id)}
                        >
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

      {creando && <ClienteForm modo="crear" usuarios={usuarios} planes={planes} onCerrar={() => setCreando(false)} />}
      {clienteEnEdicion && (
        <ClienteForm
          modo="editar"
          cliente={clienteEnEdicion}
          usuario={usuarioPorId(usuarios, clienteEnEdicion.usuarioId)}
          pago={pagoDeCliente(pagos, clienteEnEdicion.id)}
          usuarios={usuarios}
          planes={planes}
          onCerrar={() => setClienteEnEdicion(null)}
        />
      )}
    </div>
  );
}
