"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Vista = "dia" | "semana" | "mes";

interface Props {
  vista: Vista;
  titulo: string;
  onCambiarVista: (vista: Vista) => void;
  onAnterior: () => void;
  onSiguiente: () => void;
  onHoy: () => void;
}

const OPCIONES: { valor: Vista; etiqueta: string }[] = [
  { valor: "dia", etiqueta: "Día" },
  { valor: "semana", etiqueta: "Semana" },
  { valor: "mes", etiqueta: "Mes" },
];

export function SelectorVista({ vista, titulo, onCambiarVista, onAnterior, onSiguiente, onHoy }: Props) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 opacity-0"
      style={{ animation: "fade-in-up 0.4s var(--ease-spring) forwards" }}
    >
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-lg" onClick={onAnterior} aria-label="Anterior">
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button variant="outline" size="icon-lg" onClick={onSiguiente} aria-label="Siguiente">
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="default" onClick={onHoy}>
          Hoy
        </Button>
        <span className="text-sm font-medium">{titulo}</span>
      </div>
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {OPCIONES.map(({ valor, etiqueta }) => (
          <Button
            key={valor}
            size="default"
            variant={vista === valor ? "default" : "ghost"}
            onClick={() => onCambiarVista(valor)}
          >
            {etiqueta}
          </Button>
        ))}
      </div>
    </div>
  );
}