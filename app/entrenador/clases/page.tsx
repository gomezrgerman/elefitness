import { CalendarioClases } from "@/components/calendario/calendario-clases";
import {
  obtenerClases,
  obtenerSesiones,
  obtenerReservas,
  obtenerClientes,
  obtenerUsuarios,
  obtenerPlanes,
} from "@/lib/supabase/queries";

export default async function EntrenadorClasesPage() {
  const [clases, sesiones, reservas, clientes, usuarios, planes] = await Promise.all([
    obtenerClases(),
    obtenerSesiones(),
    obtenerReservas(),
    obtenerClientes(),
    obtenerUsuarios(),
    obtenerPlanes(),
  ]);

  const ahora = new Date().toISOString();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Clases</h1>
      <CalendarioClases
        hoy={ahora.slice(0, 10)}
        ahora={ahora}
        clases={clases}
        sesiones={sesiones}
        reservas={reservas}
        clientes={clientes}
        usuarios={usuarios}
        planes={planes}
        puedeQuitar={false}
      />
    </div>
  );
}
