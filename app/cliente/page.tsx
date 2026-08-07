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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Hola, {usuario.nombre}</h1>
      <MiPlan cliente={cliente} planes={planes} pagos={pagos} bonosCliente={bonosCliente} />
      <div>
        <h2 className="mb-3 text-lg font-medium">Horario semanal</h2>
        <HorarioCliente
          clienteId={cliente.id}
          clases={clases}
          sesiones={sesiones}
          reservas={reservas}
          ocupacion={ocupacion}
        />
      </div>
    </div>
  );
}
