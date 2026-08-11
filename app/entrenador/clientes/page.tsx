import { ListaClientes } from "@/components/lista-clientes";
import { EstadoVacio } from "@/components/estado-vacio";
import { obtenerClientes, obtenerUsuarios, obtenerPlanes } from "@/lib/supabase/queries";

export default async function EntrenadorClientesPage() {
  const [clientes, usuarios, planes] = await Promise.all([obtenerClientes(), obtenerUsuarios(), obtenerPlanes()]);

  const activas = clientes.filter((c) => c.estado === "activo").length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground">
          {activas} client{activas === 1 ? "a" : "as"} activ{activas === 1 ? "a" : "as"} de {clientes.length}
        </p>
      </div>
      {clientes.length === 0 ? (
        <EstadoVacio tipo="clientes" />
      ) : (
        <ListaClientes clientes={clientes} usuarios={usuarios} planes={planes} basePath="/entrenador/clientes" soloLectura />
      )}
    </div>
  );
}
