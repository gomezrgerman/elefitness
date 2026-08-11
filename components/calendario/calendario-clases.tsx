"use client";

import { useState } from "react";
import { SelectorVista, type Vista } from "./selector-vista";
import { VistaDia } from "./vista-dia";
import { VistaSemana } from "./vista-semana";
import { VistaMes } from "./vista-mes";
import { formatearDiaLargo, formatearMes, formatearRangoSemana, sumarDias, sumarMeses } from "@/lib/fechas";
import type { Clase, Sesion, Reserva, Cliente, Usuario, Plan } from "@/lib/types";

interface Props {
  hoy: string;
  ahora: string;
  clases: Clase[];
  sesiones: Sesion[];
  reservas: Reserva[];
  clientes: Cliente[];
  usuarios: Usuario[];
  planes: Plan[];
  puedeQuitar: boolean;
}

export function CalendarioClases({
  hoy,
  ahora,
  clases,
  sesiones,
  reservas,
  clientes,
  usuarios,
  planes,
  puedeQuitar,
}: Props) {
  const [vista, setVista] = useState<Vista>("dia");
  const [fecha, setFecha] = useState(hoy);

  const titulo =
    vista === "dia" ? formatearDiaLargo(fecha) : vista === "semana" ? formatearRangoSemana(fecha) : formatearMes(fecha);

  function mover(direccion: 1 | -1) {
    if (vista === "dia") setFecha(sumarDias(fecha, direccion));
    else if (vista === "semana") setFecha(sumarDias(fecha, 7 * direccion));
    else setFecha(sumarMeses(fecha, direccion));
  }

  function irADia(nueva: string) {
    setFecha(nueva);
    setVista("dia");
  }

  return (
    <div className="flex flex-col gap-4">
      <SelectorVista
        vista={vista}
        titulo={titulo}
        onCambiarVista={setVista}
        onAnterior={() => mover(-1)}
        onSiguiente={() => mover(1)}
        onHoy={() => setFecha(hoy)}
      />

      {vista === "dia" && (
        <VistaDia
          fecha={fecha}
          ahora={ahora}
          clases={clases}
          sesiones={sesiones}
          reservas={reservas}
          clientes={clientes}
          usuarios={usuarios}
          planes={planes}
          puedeQuitar={puedeQuitar}
        />
      )}
      {vista === "semana" && (
        <VistaSemana fecha={fecha} hoy={hoy} clases={clases} sesiones={sesiones} reservas={reservas} onIrADia={irADia} />
      )}
      {vista === "mes" && (
        <VistaMes fecha={fecha} hoy={hoy} clases={clases} sesiones={sesiones} reservas={reservas} onIrADia={irADia} />
      )}
    </div>
  );
}
