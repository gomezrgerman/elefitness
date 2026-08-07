import { CalendarioSemanal } from "@/components/calendario-semanal";
import { obtenerClases, obtenerSesiones, obtenerReservas, obtenerClientes, obtenerUsuarios } from "@/lib/supabase/queries";

export default async function EntrenadorClasesPage() {
  const [clases, sesiones, reservas, clientes, usuarios] = await Promise.all([
    obtenerClases(),
    obtenerSesiones(),
    obtenerReservas(),
    obtenerClientes(),
    obtenerUsuarios(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Clases</h1>
      <CalendarioSemanal clases={clases} sesiones={sesiones} reservas={reservas} clientes={clientes} usuarios={usuarios} />
    </div>
  );
}
