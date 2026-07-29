import { TablaCobros } from "@/components/tabla-cobros";

export default function AdminCobrosPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Cobros</h1>
      <TablaCobros />
    </div>
  );
}
