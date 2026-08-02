import { TablaCobros } from "@/components/tabla-cobros";
import { obtenerPagos, obtenerClientes, obtenerUsuarios, obtenerPlanes } from "@/lib/supabase/queries";

export default async function AdminCobrosPage() {
  const [pagos, clientes, usuarios, planes] = await Promise.all([
    obtenerPagos(),
    obtenerClientes(),
    obtenerUsuarios(),
    obtenerPlanes(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Cobros</h1>
      <TablaCobros pagos={pagos} clientes={clientes} usuarios={usuarios} planes={planes} />
    </div>
  );
}
