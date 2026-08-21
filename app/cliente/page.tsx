import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReservaCliente } from "@/components/reserva-cliente";
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
import type { Sesion, Clase } from "@/lib/types";

export default async function ClientePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const hoy = hoyEnEspana();
  const limite = sumarDias(hoy, 21);
  const ahora = new Date();

  // Acotado a la ventana de reserva de 3 semanas: es todo lo que esta pantalla
  // muestra, y evita traer la tabla entera de sesiones/reservas del centro
  // (ver docs/deuda-tecnica.md).
  const [cliente, usuarios, clases, sesiones, reservas, planes, pagos, bonosCliente, ocupacion] = await Promise.all([
    obtenerClienteDeUsuario(user.id),
    obtenerUsuarios(),
    obtenerClases(),
    obtenerSesiones({ desde: hoy, hasta: limite }),
    obtenerReservas({ desde: hoy, hasta: limite }),
    obtenerPlanes(),
    obtenerPagos(),
    obtenerBonosCliente(),
    obtenerOcupacionSesiones(),
  ]);

  if (!cliente) redirect("/login");
  const usuario = usuarioPorId(usuarios, user.id);
  if (!usuario) redirect("/login");

  // TS no propaga el `if (!cliente) redirect(...)` de arriba dentro de las
  // funciones anidadas de aqui abajo; se capturan en constantes ya no-nulas
  // en vez de repetir la comprobacion o usar `!`.
  const clienteId = cliente.id;
  const entrenadorRestringidoId = cliente.entrenadorRestringidoId;

  // Una sesion cerrada no aparece en el listado de reserva de nadie, salvo
  // que la clienta ya tenga una reserva activa ahi: ve su propia plaza, no la
  // hora suelta que Elena no ha abierto. Igual con el entrenador restringido
  // -- cambiarle la restriccion no le cancela lo que ya tenia reservado.
  function reservablePorCualquiera(sesion: Sesion, clase: Clase): boolean {
    if (!sesion.abierta) return false;
    if (entrenadorRestringidoId && clase.entrenadorId !== entrenadorRestringidoId) return false;
    return true;
  }
  function sesionVisibleParaClienta(sesion: Sesion, clase: Clase): boolean {
    if (reservablePorCualquiera(sesion, clase)) return true;
    return Boolean(reservaActivaDeClienteEnSesion(reservas, clienteId, sesion.id));
  }
  const sesionesVisibles = sesiones.filter((s) => {
    const clase = clases.find((c) => c.id === s.claseId);
    return clase ? sesionVisibleParaClienta(s, clase) : false;
  });

  // El conteo exacto se resuelve aqui y nunca llega al navegador de la clienta.
  const sesionesLibres: Record<string, boolean> = {};
  for (const sesion of sesionesVisibles) {
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
                  {usuarios.find((u) => u.id === claseHoy.entrenadorId)?.nombre ?? "—"}
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

      <MiPlan cliente={cliente} planes={planes} pagos={pagos} bonosCliente={bonosCliente} clases={clases} />
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Reserva tu clase
        </h2>
        <ReservaCliente
          clienteId={cliente.id}
          hoy={hoy}
          limite={limite}
          sesionesLibres={sesionesLibres}
          clases={clases}
          sesiones={sesionesVisibles}
          reservas={reservas}
          // Solo id y nombre cruzan al componente cliente: es lo unico que la
          // pantalla necesita para mostrar quien da la clase, y esta prop se
          // serializa entera en el bundle que llega al navegador de la
          // clienta -- el resto de la fila (email, telefono) no tiene por
          // que viajar hasta ahi solo porque la consulta del servidor la trae.
          usuarios={usuarios.map((u) => ({ id: u.id, nombre: u.nombre }))}
        />
      </div>
    </div>
  );
}
