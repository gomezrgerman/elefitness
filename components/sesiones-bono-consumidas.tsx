"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { devolverCreditoSesion, anadirSesionExtraBono } from "@/lib/actions/bonos";
import { formatearDiaLargo } from "@/lib/fechas";
import type { Reserva, Sesion, Clase } from "@/lib/types";

interface Props {
  reservas: Reserva[];
  sesiones: Sesion[];
  clases: Clase[];
}

export function SesionesBonoConsumidas({ reservas, sesiones, clases }: Props) {
  const [pendiente, startTransition] = useTransition();
  const [pendienteId, setPendienteId] = useState<string | null>(null);
  const { toast } = useToast();

  if (reservas.length === 0) return null;

  function descripcion(sesionId: string): string {
    const sesion = sesiones.find((s) => s.id === sesionId);
    if (!sesion) return "Clase eliminada";
    const clase = clases.find((c) => c.id === sesion.claseId);
    return `${formatearDiaLargo(sesion.fecha)}${clase ? ` · ${clase.horaInicio}` : ""}`;
  }

  function devolver(reservaId: string) {
    setPendienteId(reservaId);
    startTransition(async () => {
      const respuesta = await devolverCreditoSesion(reservaId);
      if (respuesta.error) toast(respuesta.error, "error");
      else toast("Credito devuelto", "success");
    });
  }

  function anadir(bonoId: string) {
    setPendienteId(bonoId);
    startTransition(async () => {
      const respuesta = await anadirSesionExtraBono(bonoId);
      if (respuesta.error) toast(respuesta.error, "error");
      else toast("Sesion extra anadida al bono", "success");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sesiones de bono consumidas</CardTitle>
        <p className="text-xs text-muted-foreground">
          Cada fila descarto un credito al reservar. Las dos acciones son remedios independientes: una deshace ese
          descuento, la otra suma un credito extra sin tocarlo.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {reservas.map((reserva) => (
          <div key={reserva.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-b-0 last:pb-0">
            <span>{descripcion(reserva.sesionId)}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pendiente && pendienteId === reserva.id}
                onClick={() => devolver(reserva.id)}
              >
                Devolver credito
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pendiente && pendienteId === reserva.bonoId}
                onClick={() => reserva.bonoId && anadir(reserva.bonoId)}
              >
                Anadir sesion extra
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
