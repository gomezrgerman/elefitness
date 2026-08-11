"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { usuarioPorId, clientePorId, planPorId } from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";
import { registrarPago } from "@/lib/actions/pagos";
import { hoyEnEspana, sumarMesesMismoDia } from "@/lib/fechas";
import type { Pago, Cliente, Usuario, Plan } from "@/lib/types";

interface Props {
  pagos: Pago[];
  clientes: Cliente[];
  usuarios: Usuario[];
  planes: Plan[];
  soloLectura?: boolean;
}

export function TablaCobros({ pagos, clientes, usuarios, planes, soloLectura = false }: Props) {
  const [procesando, setProcesando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function marcarComoPagado(pago: Pago) {
    setProcesando(pago.id);
    setError(null);
    const fechaHoy = hoyEnEspana();
    const proximoCobro = pago.tipo === "mensual" ? sumarMesesMismoDia(fechaHoy, 1) : null;
    const respuesta = await registrarPago({ pagoId: pago.id, fechaPago: fechaHoy, proximoCobro });
    if (respuesta.error) setError(respuesta.error);
    setProcesando(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Clienta</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Metodo</TableHead>
            <TableHead>Importe</TableHead>
            <TableHead>Ultimo cobro</TableHead>
            <TableHead>Proximo cobro</TableHead>
            <TableHead>Estado</TableHead>
            {!soloLectura && <TableHead className="text-right">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagos.map((pago) => {
            const cliente = clientePorId(clientes, pago.clienteId);
            const usuario = cliente ? usuarioPorId(usuarios, cliente.usuarioId) : undefined;
            const plan = planPorId(planes, pago.planId);
            return (
              <TableRow key={pago.id}>
                <TableCell className="font-medium">{usuario?.nombre ?? "—"}</TableCell>
                <TableCell>{plan?.nombre ?? "—"}</TableCell>
                <TableCell className="capitalize">{pago.metodo}</TableCell>
                <TableCell>{pago.importe.toFixed(2)} €</TableCell>
                <TableCell>{pago.ultimoCobro ?? "—"}</TableCell>
                <TableCell>{pago.proximoCobro ?? "—"}</TableCell>
                <TableCell>
                  <BadgeEstado estado={pago.estado} />
                </TableCell>
                {!soloLectura && (
                  <TableCell className="text-right">
                    {pago.estado !== "al_dia" && (
                      <Button size="sm" disabled={procesando === pago.id} onClick={() => marcarComoPagado(pago)}>
                        Marcar como pagado hoy
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
