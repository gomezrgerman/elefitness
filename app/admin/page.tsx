import { UsersIcon, CalendarIcon, CreditCardIcon, TrendingUpIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BadgeEstado } from "@/components/badge-estado";
import {
  obtenerClientes,
  obtenerUsuarios,
  obtenerClases,
  obtenerSesiones,
  obtenerReservas,
  obtenerPagos,
} from "@/lib/supabase/queries";

export default async function AdminDashboard() {
  const [clientes, usuarios, clases, sesiones, reservas, pagos] = await Promise.all([
    obtenerClientes(),
    obtenerUsuarios(),
    obtenerClases(),
    obtenerSesiones(),
    obtenerReservas(),
    obtenerPagos(),
  ]);

  const activas = clientes.filter((c) => c.estado === "activo").length;
  const hoy = new Date().toISOString().slice(0, 10);
  const clasesHoy = sesiones.filter((s) => s.fecha === hoy).length;
  const alDia = pagos.filter((p) => p.estado === "al_dia").length;
  const morosos = pagos.filter((p) => p.estado === "moroso").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">Buenos dias, Elena</p>
        <h1 className="text-2xl font-semibold">Resumen del centro</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-950/50">
              <CreditCardIcon className="size-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{alDia}</p>
              <p className="text-xs text-muted-foreground">Pagos al dia</p>
            </div>
          </CardContent>
        </Card>

        <Card className={morosos > 0 ? "hover:ring-red-800/60" : "hover:ring-primary/40"}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-950/50">
              <TrendingUpIcon className="size-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{morosos}</p>
              <p className="text-xs text-muted-foreground">Pagos pendientes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {clasesHoy > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Proximas clases</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sesiones
              .filter((s) => s.fecha >= hoy)
              .sort((a, b) => a.fecha.localeCompare(b.fecha))
              .slice(0, 3)
              .map((sesion) => {
                const clase = clases.find((c) => c.id === sesion.claseId);
                const entrenador = usuarios.find((u) => u.id === clase?.entrenadorId);
                const ocupadas = reservas.filter((r) => r.sesionId === sesion.id && r.estado === "confirmada").length;
                const aforo = sesion.aforoEfectivo ?? clase?.aforoMax ?? 0;
                return (
                  <Card key={sesion.id} size="sm">
                    <CardContent className="flex items-center justify-between p-3">
                      <div>
                        <p className="text-sm font-medium">
                          {sesion.fecha} · {clase?.horaInicio}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entrenador?.nombre ?? "—"} · {ocupadas}/{aforo}
                        </p>
                      </div>
                      <BadgeEstado estado={ocupadas >= aforo ? "lista_espera" : "confirmada"} />
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
