import { CalendarioSemanal } from "@/components/calendario-semanal";

export default function EntrenadorClasesPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Clases</h1>
      <CalendarioSemanal />
    </div>
  );
}
