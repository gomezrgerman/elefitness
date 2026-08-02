"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ORDEN_DIAS, reservaActivaDeClienteEnClase } from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";
import { reservarClase, cancelarReserva } from "@/lib/actions/reservas";
import type { Clase, Reserva } from "@/lib/types";

const ETIQUETA_DIA: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miercoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sabado",
  domingo: "Domingo",
};

interface Props {
  clienteId: string;
  clases: Clase[];
  reservas: Reserva[];
  ocupacion: Record<string, number>;
}

export function HorarioCliente({ clienteId, clases, reservas, ocupacion }: Props) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reservar(claseId: string) {
    setError(null);
    startTransition(async () => {
      const respuesta = await reservarClase(claseId, clienteId);
      if (respuesta.error) setError(respuesta.error);
    });
  }

  function cancelar(reservaId: string) {
    setError(null);
    startTransition(async () => {
      const respuesta = await cancelarReserva(reservaId);
      if (respuesta.error) setError(respuesta.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ORDEN_DIAS.map((dia) => {
          const clasesDelDia = clases.filter((c) => c.dia === dia);
          if (clasesDelDia.length === 0) return null;
          return (
            <div key={dia} className="flex flex-col gap-3">
              <h3 className="font-medium">{ETIQUETA_DIA[dia]}</h3>
              {clasesDelDia.map((clase) => {
                const libres = clase.aforoMax - (ocupacion[clase.id] ?? 0);
                const miReserva = reservaActivaDeClienteEnClase(reservas, clienteId, clase.id);
                return (
                  <Card key={clase.id}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {clase.horaInicio} - {clase.horaFin}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{Math.max(libres, 0)} plazas libres de {clase.aforoMax}</p>
                    </CardHeader>
                    <CardContent>
                      {miReserva ? (
                        <div className="flex items-center justify-between">
                          <BadgeEstado estado={miReserva.estado} />
                          <Button variant="outline" size="sm" disabled={pendiente} onClick={() => cancelar(miReserva.id)}>
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" disabled={pendiente} onClick={() => reservar(clase.id)}>
                          {libres > 0 ? "Reservar" : "Unirse a lista de espera"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
