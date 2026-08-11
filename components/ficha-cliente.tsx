import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BadgeEstado } from "./badge-estado";
import { planPorId, creditosRestantes } from "@/lib/selectors";
import { formatearDiaLargo } from "@/lib/fechas";
import type {
  Cliente, Usuario, Plan, Pago, BonoCliente, MovimientoHistorial, Sesion, Clase,
} from "@/lib/types";

interface Props {
  cliente: Cliente;
  usuario: Usuario;
  planes: Plan[];
  pagos: Pago[];
  bonos: BonoCliente[];
  historial: MovimientoHistorial[];
  sesiones: Sesion[];
  clases: Clase[];
}

const ETIQUETA_EVENTO: Record<string, string> = {
  apuntado: "Se apunto",
  en_lista_espera: "Entro en lista de espera",
  desapuntado: "Se desapunto",
  promovido_desde_lista_espera: "Entro desde lista de espera",
  asistio: "Vino",
  no_asistio: "Falto",
  asistencia_corregida: "Asistencia corregida",
};

export function FichaCliente({ cliente, usuario, planes, pagos, bonos, historial, sesiones, clases }: Props) {
  const plan = planPorId(planes, cliente.planId);
  const hoy = new Date().toISOString().slice(0, 10);
  const bonosActivos = bonos.filter((b) => b.activo && (!b.fechaCaducidad || b.fechaCaducidad >= hoy));

  function descripcionDeSesion(sesionId: string): string {
    const sesion = sesiones.find((s) => s.id === sesionId);
    if (!sesion) return "Clase eliminada";
    const clase = clases.find((c) => c.id === sesion.claseId);
    return `${formatearDiaLargo(sesion.fecha)}${clase ? ` · ${clase.horaInicio}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{usuario.nombre}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {usuario.email} · {usuario.telefono}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Estado:</span>
            <BadgeEstado estado={cliente.estado} />
          </div>
          <p>
            <span className="text-muted-foreground">Plan: </span>
            {plan?.nombre ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Dias por semana: </span>
            {cliente.diasSemanaHabituales}
          </p>
          {cliente.deudaCreditos > 0 && (
            <p className="text-amber-700">
              Tiene {cliente.deudaCreditos} sesion(es) de deuda, se descontaran de su proximo bono.
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Notas de rutina: </span>
            {cliente.notasRutina || "—"}
          </p>
        </CardContent>
      </Card>

      {bonosActivos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bonos activos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {bonosActivos.map((bono) => (
              <div key={bono.id} className="flex items-center justify-between">
                <span>
                  {bono.tipo === "recuperacion" ? "Bono de recuperacion" : "Bono"} ·{" "}
                  {creditosRestantes(bono)} de {bono.creditosTotales}
                </span>
                <span className="text-muted-foreground">
                  {bono.fechaCaducidad ? `caduca ${bono.fechaCaducidad}` : "sin caducidad"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de pagos</CardTitle>
        </CardHeader>
        <CardContent>
          {pagos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Importe</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagos.map((pago) => (
                  <TableRow key={pago.id}>
                    <TableCell>{pago.fechaPago}</TableCell>
                    <TableCell>{pago.importe} €</TableCell>
                    <TableCell>{pago.metodo}</TableCell>
                    <TableCell>
                      <BadgeEstado estado={pago.estado} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de asistencia</CardTitle>
        </CardHeader>
        <CardContent>
          {historial.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos todavia.</p>
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              {historial.map((movimiento) => (
                <div key={movimiento.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-b-0">
                  <span>{ETIQUETA_EVENTO[movimiento.evento] ?? movimiento.evento}</span>
                  <span className="text-muted-foreground">{descripcionDeSesion(movimiento.sesionId)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
