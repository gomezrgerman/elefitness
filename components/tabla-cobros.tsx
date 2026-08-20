"use client";

import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { usuarioPorId, clientePorId, planPorId } from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";
import { registrarPago } from "@/lib/actions/pagos";
import { hoyEnEspana, sumarMesesMismoDia } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { SearchIcon } from "lucide-react";
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
  const [busqueda, setBusqueda] = useState("");
  // Importe editado por fila antes de confirmar el cobro (pago parcial o
  // cuota personalizada). Sin entrada aqui se usa el importe que ya tenia.
  const [importesEditados, setImportesEditados] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return pagos;
    const q = busqueda.toLowerCase();
    return pagos.filter((p) => {
      const c = clientePorId(clientes, p.clienteId);
      const u = c ? usuarioPorId(usuarios, c.usuarioId) : undefined;
      const pl = planPorId(planes, p.planId);
      return (
        u?.nombre?.toLowerCase().includes(q) ||
        pl?.nombre?.toLowerCase().includes(q) ||
        p.metodo?.toLowerCase().includes(q)
      );
    });
  }, [pagos, clientes, usuarios, planes, busqueda]);

  async function marcarComoPagado(pago: Pago) {
    setProcesando(pago.id);
    setError(null);
    const fechaHoy = hoyEnEspana();
    // El siguiente cobro avanza siempre desde el proximo_cobro que ya tenia
    // la clienta, no desde el dia en que Elena pulsa el boton: si registra el
    // pago con unos dias de retraso, la fecha de facturacion no debe
    // desplazarse hacia adelante de forma permanente. Solo se ancla a hoy si
    // todavia no tenia ningun ciclo (proximo_cobro nulo, primer pago).
    const proximoCobro = pago.tipo === "mensual" ? sumarMesesMismoDia(pago.proximoCobro ?? fechaHoy, 1) : null;
    const importeEditado = importesEditados[pago.id];
    const importe =
      importeEditado !== undefined && importeEditado !== "" && Number(importeEditado) !== pago.importe
        ? Number(importeEditado)
        : undefined;
    const respuesta = await registrarPago({ pagoId: pago.id, fechaPago: fechaHoy, proximoCobro, importe });
    if (respuesta.error) {
      setError(respuesta.error);
      toast(respuesta.error, "error");
    } else {
      toast("Pago registrado", "success");
    }
    setProcesando(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, plan o metodo..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-8"
        />
      </div>
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
          {filtrados.map((pago, idx) => {
            const cliente = clientePorId(clientes, pago.clienteId);
            const usuario = cliente ? usuarioPorId(usuarios, cliente.usuarioId) : undefined;
            const plan = planPorId(planes, pago.planId);
            return (
              <TableRow
                key={pago.id}
                className={cn("opacity-0", `animate-stagger-${Math.min(idx + 1, 10)}`)}
                style={{ animation: "fade-in-up 0.4s var(--ease-spring) forwards" }}
              >
                <TableCell className="font-medium">{usuario?.nombre ?? "—"}</TableCell>
                <TableCell>{plan?.nombre ?? "—"}</TableCell>
                <TableCell className="capitalize">{pago.metodo}</TableCell>
                <TableCell>
                  {!soloLectura && pago.estado !== "al_dia" ? (
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-8 w-24"
                      value={importesEditados[pago.id] ?? pago.importe}
                      onChange={(e) => setImportesEditados((prev) => ({ ...prev, [pago.id]: e.target.value }))}
                    />
                  ) : (
                    `${pago.importe.toFixed(2)} EUR`
                  )}
                </TableCell>
                <TableCell>{pago.ultimoCobro ?? "—"}</TableCell>
                <TableCell>{pago.proximoCobro ?? "—"}</TableCell>
                <TableCell>
                  <BadgeEstado estado={pago.estado} />
                </TableCell>
                {!soloLectura && (
                  <TableCell className="text-right">
                    {pago.estado !== "al_dia" && (
                      <Button
                        size="sm"
                        disabled={procesando === pago.id}
                        onClick={() => marcarComoPagado(pago)}
                      >
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
