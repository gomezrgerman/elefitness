"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppStore } from "@/lib/mock-store";
import { usuarioPorId, clientePorId, planPorId } from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";

export function TablaCobros() {
  const { pagos, clientes, usuarios, planes } = useAppStore();

  return (
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
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
