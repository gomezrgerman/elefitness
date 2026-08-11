import { CalendarioSemanal } from "@/components/calendario-semanal";
import { EstadoVacio } from "@/components/estado-vacio";
import {
  obtenerClases,
  obtenerSesiones,
  obtenerReservas,
  obtenerClientes,
  obtenerUsuarios,
} from "@/lib/supabase/queries";

export default async function EntrenadorClasesPage() {
  const [clases, sesiones, reservas, clientes, usuarios] = await Promise.all([
    obtenerClases(),
    obtenerSesiones(),
    obtenerReservas(),
    obtenerClientes(),
    obtenerUsuarios(),
  ]);

  const hoy = new Date().toISOString().slice(0, 10);
  const sesionesFuturas = sesiones.filter((s) => s.fecha >= hoy).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground">
          {sesionesFuturas} sesion{sesionesFuturas !== 1 ? "es" : ""} programada{sesionesFuturas !== 1 ? "s" : ""}
        </p>
      </div>
      {clases.length === 0 ? (
        <EstadoVacio tipo="clases" />
      ) : (
        <CalendarioSemanal
          clases={clases}
          sesiones={sesiones}
          reservas={reservas}
          clientes={clientes}
          usuarios={usuarios}
        />
      )}
    </div>
  );
}
