import { Badge } from "@/components/ui/badge";

const ESTILOS: Record<string, string> = {
  activo: "bg-green-100 text-green-800 hover:bg-green-100",
  baja: "bg-gray-100 text-gray-600 hover:bg-gray-100",
  confirmada: "bg-green-100 text-green-800 hover:bg-green-100",
  lista_espera: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  cancelada: "bg-gray-100 text-gray-500 hover:bg-gray-100",
  al_dia: "bg-green-100 text-green-800 hover:bg-green-100",
  moroso: "bg-red-100 text-red-800 hover:bg-red-100",
  pendiente: "bg-amber-100 text-amber-800 hover:bg-amber-100",
};

const ETIQUETAS: Record<string, string> = {
  activo: "Activo",
  baja: "Baja",
  confirmada: "Confirmada",
  lista_espera: "Lista de espera",
  cancelada: "Cancelada",
  al_dia: "Al dia",
  moroso: "Moroso",
  pendiente: "Pendiente",
};

export function BadgeEstado({ estado }: { estado: string }) {
  return (
    <Badge variant="outline" className={ESTILOS[estado] ?? ""}>
      {ETIQUETAS[estado] ?? estado}
    </Badge>
  );
}
