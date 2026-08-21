"use client";

import { useState } from "react";
import { CalendarioClases } from "./calendario-clases";
import { RejillaHuecos } from "./rejilla-huecos";
import { RejillaHorarioFijo } from "./rejilla-horario-fijo";
import { cn } from "@/lib/utils";
import type { Clase, Sesion, Reserva, Cliente, Usuario, Plan, FranjaHoraria } from "@/lib/types";

interface Props {
  hoy: string;
  ahora: string;
  clases: Clase[];
  sesiones: Sesion[];
  reservas: Reserva[];
  clientes: Cliente[];
  usuarios: Usuario[];
  planes: Plan[];
  franjas: FranjaHoraria[];
  esAdmin: boolean;
}

// Dos vistas que Elena pidio como cosas separadas: "esta semana" son las
// reservas reales (bajas, vacaciones...) y "horario fijo" es la plantilla
// estructural de grupos que sustituye a su Excel -- no dependen la una de
// la otra, por eso son pestañas y no capas del mismo calendario.
export function VistaClases({ hoy, ahora, clases, sesiones, reservas, clientes, usuarios, planes, franjas, esAdmin }: Props) {
  const [vista, setVista] = useState<"semana" | "fijo">("semana");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-0.5 rounded-lg border p-0.5 sm:inline-flex sm:w-auto">
        <button
          type="button"
          onClick={() => setVista("semana")}
          className={cn(
            "min-h-11 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:min-h-0",
            vista === "semana" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Esta semana
        </button>
        <button
          type="button"
          onClick={() => setVista("fijo")}
          className={cn(
            "min-h-11 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:min-h-0",
            vista === "fijo" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Horario fijo
        </button>
      </div>

      {vista === "semana" ? (
        <>
          <CalendarioClases
            hoy={hoy}
            ahora={ahora}
            clases={clases}
            sesiones={sesiones}
            reservas={reservas}
            clientes={clientes}
            usuarios={usuarios}
            planes={planes}
            puedeQuitar={esAdmin}
          />
          <RejillaHuecos
            hoy={hoy}
            franjas={franjas}
            clases={clases}
            sesiones={sesiones}
            reservas={reservas}
            usuarios={usuarios}
            puedeAbrir={esAdmin}
          />
        </>
      ) : (
        <RejillaHorarioFijo
          franjas={franjas}
          clases={clases}
          clientes={clientes}
          usuarios={usuarios}
          planes={planes}
          puedeEditar={esAdmin}
        />
      )}
    </div>
  );
}
