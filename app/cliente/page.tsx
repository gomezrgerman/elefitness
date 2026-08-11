import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HorarioCliente } from "@/components/horario-cliente";
import { MiPlan } from "@/components/mi-plan";
import { Card, CardContent } from "@/components/ui/card";
import { BadgeEstado } from "@/components/badge-estado";
import { CalendarIcon, ClockIcon } from "lucide-react";
import {
  obtenerClienteDeUsuario,
  obtenerUsuarios,
  obtenerClases,
  obtenerSesiones,
  obtenerReservas,
  obtenerPlanes,
  obtenerPagos,
  obtenerBonosCliente,
  obtenerOcupacionSesiones,
} from "@/lib/supabase/queries";
import { usuarioPorId, reservaActivaDeClienteEnSesion } from "@/lib/selectors";
import { sumarDias, hoyEnEspana, instanteEnEspana } from "@/lib/fechas";

export default async function ClientePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [cliente, usuarios, clases, sesiones, reservas, planes, pagos, bonosCliente, ocupacion] = await Promise.all([
    obtenerClienteDeUsuario(user.id),
    obtenerUsuarios(),
    obtenerClases(),
    obtenerSesiones(),
    obtenerReservas(),
    obtenerPlanes(),
    obtenerPagos(),
    obtenerBonosCliente(),
    obtenerOcupacionSesiones(),
  ]);

  if (!cliente) redirect("/login");
  const usuario = usuarioPorId(usuarios, user.id);
  if (!usuario) redirect("/login");

  // El conteo exacto se resuelve aqui y nunca llega al navegador de la clienta.
  const hoy = hoyEnEspana();
  const limite = sumarDias(hoy, 21);
  const sesionesLibres: Record<string, boolean> = {};
  for (const sesion of sesiones) {
    const clase = clases.find((c) => c.id === sesion.claseId);
    if (!clase) continue;
    const aforo = sesion.aforoEfectivo ?? clase.aforoMax;
    sesionesLibres[sesion.id] = (ocupacion[sesion.id] ?? 0) < aforo;
  }

  // La tarjeta "Tienes clase hoy" solo debe desaparecer cuando la clase ya ha
  // terminado (horaFin), no cuando empieza: mientras esta en curso la clienta
  // sigue teniendo clase hoy y el rango de horas mostrado sigue siendo util.
  // Comparar solo por fecha (sin instanteEnEspana) dejaba la tarjeta anunciando
  // una clase de las 09:00 a las 21:00, el mismo bug que ya se corrigio en
  // horario-cliente.tsx.
  const ahora = new Date();
  const sesionesHoy = sesiones.filter((s) => s.fecha === hoy);
  const reservaHoy = sesionesHoy.find((s) => {
    const r = reservaActivaDeClienteEnSesion(reservas, cliente.id, s.id);
    if (!r || r.estado !== "confirmada") return false;
    const clase = clases.find((c) => c.id === s.claseId);
    if (!clase) return false;
    return instanteEnEspana(s.fecha, clase.horaFin) > ahora;
  });
  const claseHoy = reservaHoy ? clases.find((c) => c.id === reservaHoy.claseId) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">Hola, {usuario.nombre}</p>
        <h1 className="text-2xl font-semibold">Tu entrenamiento</h1>
      </div>

      {claseHoy && reservaHoy ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                <CalendarIcon className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Tienes clase hoy</p>
                <p className="text-xs text-muted-foreground">
                  {claseHoy.horaInicio} - {claseHoy.horaFin}
                  {" · "}
                  {usuarios.find((u) => u.id === claseHoy.entrenadorId)?.nombre ?? "tu entrenador"}
                </p>
              </div>
            </div>
            <BadgeEstado estado="confirmada" />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/50">
              <ClockIcon className="size-5 text-muted-foreground/60" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Sin clase reservada para hoy</p>
              <p className="text-xs text-muted-foreground">Revisa el horario y reserva tu plaza</p>
            </div>
          </CardContent>
        </Card>
      )}

      <MiPlan cliente={cliente} planes={planes} pagos={pagos} bonosCliente={bonosCliente} />
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Horario semanal
        </h2>
        <HorarioCliente
          clienteId={cliente.id}
          hoy={hoy}
          limite={limite}
          sesionesLibres={sesionesLibres}
          clases={clases}
          sesiones={sesiones}
          reservas={reservas}
        />
      </div>
    </div>
  );
}
