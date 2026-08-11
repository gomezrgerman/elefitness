import { Badge } from "@/components/ui/badge";

const ESTILOS: Record<string, string> = {
  activo: "bg-emerald-950/50 text-emerald-300 border-emerald-800/60 hover:bg-emerald-950/50",
  baja: "bg-zinc-800/60 text-zinc-400 border-zinc-700/60 hover:bg-zinc-800/60",
  confirmada: "bg-emerald-950/50 text-emerald-300 border-emerald-800/60 hover:bg-emerald-950/50 animate-pulse",
  lista_espera: "bg-amber-950/50 text-amber-300 border-amber-800/60 hover:bg-amber-950/50",
  cancelada: "bg-zinc-800/40 text-zinc-500 border-zinc-800/40 hover:bg-zinc-800/40",
  al_dia: "bg-emerald-950/50 text-emerald-300 border-emerald-800/60 hover:bg-emerald-950/50",
  moroso: "bg-red-950/50 text-red-300 border-red-800/60 hover:bg-red-950/50 animate-pulse",
  pendiente: "bg-amber-950/50 text-amber-300 border-amber-800/60 hover:bg-amber-950/50",
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
