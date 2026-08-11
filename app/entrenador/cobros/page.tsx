import { TablaCobros } from "@/components/tabla-cobros";
import { EstadoVacio } from "@/components/estado-vacio";
import {
  obtenerPagos,
  obtenerClientes,
  obtenerUsuarios,
  obtenerPlanes,
} from "@/lib/supabase/queries";

export default async function EntrenadorCobrosPage() {
  const [pagos, clientes, usuarios, planes] = await Promise.all([
    obtenerPagos(),
    obtenerClientes(),
    obtenerUsuarios(),
    obtenerPlanes(),
  ]);

  const alDia = pagos.filter((p) => p.estado === "al_dia").length;
  const morosos = pagos.filter((p) => p.estado === "moroso").length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground">
          {alDia} al dia{morosos > 0 ? ` · ${morosos} pendiente${morosos !== 1 ? "s" : ""}` : ""}
        </p>
      </div>
      {pagos.length === 0 ? (
        <EstadoVacio tipo="cobros" />
      ) : (
        <TablaCobros pagos={pagos} clientes={clientes} usuarios={usuarios} planes={planes} soloLectura />
      )}
    </div>
  );
}
