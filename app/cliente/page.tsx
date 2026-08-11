import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HorarioCliente } from "@/components/horario-cliente";
import { MiPlan } from "@/components/mi-plan";
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
import { usuarioPorId } from "@/lib/selectors";
import { sumarDias, hoyEnEspana } from "@/lib/fechas";

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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Hola, {usuario.nombre}</h1>
      <MiPlan cliente={cliente} planes={planes} pagos={pagos} bonosCliente={bonosCliente} />
      <div>
        <h2 className="mb-3 text-lg font-medium">Proximas clases</h2>
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
