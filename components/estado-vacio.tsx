import { type LucideIcon, UsersIcon, CalendarIcon, CreditCardIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

const ICONOS: Record<string, LucideIcon> = {
  clientes: UsersIcon,
  clases: CalendarIcon,
  cobros: CreditCardIcon,
  reservas: CalendarIcon,
};

const MENSAJES: Record<string, { titulo: string; descripcion: string }> = {
  clientes: {
    titulo: "No hay clientas todavia",
    descripcion: "Crea la primera clienta para empezar a gestionar reservas y pagos.",
  },
  clases: {
    titulo: "No hay clases esta semana",
    descripcion: "Las clases apareceran aqui cuando tengan sesiones programadas.",
  },
  cobros: {
    titulo: "No hay pagos registrados",
    descripcion: "Los pagos apareceran cuando las clientas tengan un plan asignado.",
  },
  reservas: {
    titulo: "Sin reservas",
    descripcion: "Las reservas apareceran cuando las clientas reserven una clase.",
  },
};

interface Props {
  tipo: keyof typeof MENSAJES;
  accion?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

export function EstadoVacio({ tipo, accion, children }: Props) {
  const Icono = ICONOS[tipo] ?? UsersIcon;
  const mensaje = MENSAJES[tipo] ?? MENSAJES.clientes;

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-10">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/50">
          <Icono className="size-7 text-muted-foreground/60" />
        </div>
        <div className="text-center max-w-xs">
          <p className="text-sm font-medium">{mensaje.titulo}</p>
          <p className="mt-1 text-xs text-muted-foreground">{mensaje.descripcion}</p>
        </div>
        {accion && (
          <Button size="sm" variant="outline" onClick={accion.onClick}>
            {accion.label}
          </Button>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
