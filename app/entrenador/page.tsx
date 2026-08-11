import { UsersIcon, CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgeEstado } from "@/components/badge-estado";
import {
  obtenerClientes,
  obtenerUsuarios,
  obtenerClases,
  obtenerSesiones,
  obtenerReservas,
} from "@/lib/supabase/queries";
import { usuarioPorId, clientePorId } from "@/lib/selectors";

export default async function EntrenadorDashboard() {
  const [clientes, usuarios, clases, sesiones, reservas] = await Promise.all([
    obtenerClientes(),
    obtenerUsuarios(),
    obtenerClases(),
    obtenerSesiones(),
    obtenerReservas(),
  ]);

  const activas = clientes.filter((c) => c.estado === "activo").length;
  const hoy = new Date().toISOString().slice(0, 10);
  const sesionesHoy = sesiones.filter((s) => s.fecha === hoy);
  const clasesHoy = sesionesHoy.length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">Buenos dias, Ivan</p>
        <h1 className="text-2xl font-semibold">Tu agenda</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="hover:ring-primary/40">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <CalendarIcon className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{clasesHoy}</p>
              <p className="text-xs text-muted-foreground">Clases hoy</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:ring-primary/40">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <UsersIcon className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{activas}</p>
              <p className="text-xs text-muted-foreground">Clientas activas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {clasesHoy > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Clases de hoy</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sesionesHoy
              .sort((a, b) => a.fecha.localeCompare(b.fecha))
              .map((sesion) => {
                const clase = clases.find((c) => c.id === sesion.claseId);
                const entrenador = usuarios.find((u) => u.id === clase?.entrenadorId);
                const confirmadas = reservas.filter(
                  (r) => r.sesionId === sesion.id && r.estado === "confirmada"
                );
                const enEspera = reservas.filter(
                  (r) => r.sesionId === sesion.id && r.estado === "lista_espera"
                );
                const aforo = sesion.aforoEfectivo ?? clase?.aforoMax ?? 0;
                return (
                  <Card key={sesion.id}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {clase?.horaInicio} - {clase?.horaFin}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {entrenador?.nombre} · {confirmadas.length}/{aforo} plazas
                      </p>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 text-sm">
                      {[...confirmadas, ...enEspera].map((reserva) => {
                        const cliente = clientePorId(clientes, reserva.clienteId);
                        const usuario = cliente
                          ? usuarioPorId(usuarios, cliente.usuarioId)
                          : undefined;
                        return (
                          <div
                            key={reserva.id}
                            className="flex items-center justify-between"
                          >
                            <span>{usuario?.nombre ?? "—"}</span>
                            <BadgeEstado estado={reserva.estado} />
                          </div>
                        );
                      })}
                      {confirmadas.length === 0 && enEspera.length === 0 && (
                        <p className="text-muted-foreground">Sin reservas hoy</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <CalendarIcon className="size-8 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-sm font-medium">No hay clases programadas hoy</p>
              <p className="text-xs text-muted-foreground">
                Consulta el calendario para ver las proximas
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
