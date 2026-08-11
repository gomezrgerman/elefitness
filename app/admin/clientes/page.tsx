import { ListaClientes } from "@/components/lista-clientes";
import { obtenerClientes, obtenerUsuarios, obtenerPlanes } from "@/lib/supabase/queries";

export default async function AdminClientesPage() {
  const [clientes, usuarios, planes] = await Promise.all([obtenerClientes(), obtenerUsuarios(), obtenerPlanes()]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Clientes</h1>
      <ListaClientes clientes={clientes} usuarios={usuarios} planes={planes} basePath="/admin/clientes" />
    </div>
  );
}
