import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaCliente } from "@/components/ficha-cliente";
import {
  obtenerClientes,
  obtenerUsuarios,
  obtenerPlanes,
  obtenerPagos,
  obtenerBonosCliente,
  obtenerSesiones,
  obtenerClases,
  obtenerReservasDeCliente,
  obtenerHorariosFijos,
} from "@/lib/supabase/queries";
import { clientePorId, usuarioPorId } from "@/lib/selectors";

export default async function EntrenadorFichaClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [clientes, usuarios, planes, pagos, bonos, sesiones, clases, reservas, horariosFijos] = await Promise.all([
    obtenerClientes(),
    obtenerUsuarios(),
    obtenerPlanes(),
    obtenerPagos(),
    obtenerBonosCliente(),
    obtenerSesiones(),
    obtenerClases(),
    obtenerReservasDeCliente(id),
    obtenerHorariosFijos(),
  ]);

  const cliente = clientePorId(clientes, id);
  if (!cliente) notFound();
  const usuario = usuarioPorId(usuarios, cliente.usuarioId);
  if (!usuario) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/entrenador/clientes" className="text-sm text-muted-foreground hover:underline">
        ← Volver a clientes
      </Link>
      <FichaCliente
        cliente={cliente}
        usuario={usuario}
        usuarios={usuarios}
        planes={planes}
        pagos={pagos.filter((p) => p.clienteId === cliente.id)}
        bonos={bonos.filter((b) => b.clienteId === cliente.id)}
        reservas={reservas}
        sesiones={sesiones}
        clases={clases}
        horariosFijos={horariosFijos.filter((h) => h.clienteId === cliente.id)}
      />
    </div>
  );
}
