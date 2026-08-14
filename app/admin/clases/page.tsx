import { CalendarioClases } from "@/components/calendario/calendario-clases";
import { RejillaHuecos } from "@/components/calendario/rejilla-huecos";
import { EstadoVacio } from "@/components/estado-vacio";
import {
  obtenerClases,
  obtenerSesiones,
  obtenerReservas,
  obtenerClientes,
  obtenerUsuarios,
  obtenerPlanes,
  obtenerFranjas,
} from "@/lib/supabase/queries";
import { hoyEnEspana } from "@/lib/fechas";

export default async function AdminClasesPage() {
  const [clases, sesiones, reservas, clientes, usuarios, planes, franjas] = await Promise.all([
    obtenerClases(),
    obtenerSesiones(),
    obtenerReservas(),
    obtenerClientes(),
    obtenerUsuarios(),
    obtenerPlanes(),
    obtenerFranjas(),
  ]);

  const hoy = hoyEnEspana();
  const ahora = new Date().toISOString();
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
        <CalendarioClases
          hoy={hoy}
          ahora={ahora}
          clases={clases}
          sesiones={sesiones}
          reservas={reservas}
          clientes={clientes}
          usuarios={usuarios}
          planes={planes}
          puedeQuitar
        />
      )}
      <RejillaHuecos hoy={hoy} franjas={franjas} clases={clases} sesiones={sesiones} usuarios={usuarios} puedeAbrir />
    </div>
  );
}
