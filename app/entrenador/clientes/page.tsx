import { ListaClientes } from "@/components/lista-clientes";

export default function EntrenadorClientesPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Clientes</h1>
      <ListaClientes soloLectura />
    </div>
  );
}
