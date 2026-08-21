import { VistaClases } from "@/components/calendario/vista-clases";
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
import { hoyEnEspana, sumarMesesMismoDia } from "@/lib/fechas";

export default async function AdminClasesPage() {
  const hoy = hoyEnEspana();
  const ahora = new Date().toISOString();
  // Ventana movil, no la tabla entera (ver docs/deuda-tecnica.md): de sobra
  // para revisar el mes pasado y planificar varios meses por delante. Fuera
  // de este rango el calendario y la rejilla dejan de mostrar contenido.
  const rango = { desde: sumarMesesMismoDia(hoy, -3), hasta: sumarMesesMismoDia(hoy, 6) };

  const [clases, sesiones, reservas, clientes, usuarios, planes, franjas] = await Promise.all([
    obtenerClases(),
    obtenerSesiones(rango),
    obtenerReservas(rango),
    obtenerClientes(),
    obtenerUsuarios(),
    obtenerPlanes(),
    obtenerFranjas(),
  ]);
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
        <VistaClases
          hoy={hoy}
          ahora={ahora}
          clases={clases}
          sesiones={sesiones}
          reservas={reservas}
          clientes={clientes}
          usuarios={usuarios}
          planes={planes}
          franjas={franjas}
          esAdmin
        />
      )}
    </div>
  );
}
