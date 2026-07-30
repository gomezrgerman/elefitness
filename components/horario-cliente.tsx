"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/mock-store";
import { ORDEN_DIAS, plazasLibres, reservaActivaDeClienteEnClase } from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";

const ETIQUETA_DIA: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miercoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sabado",
  domingo: "Domingo",
};

export function HorarioCliente({ clienteId }: { clienteId: string }) {
  const { clases, reservas, reservarClase, cancelarReserva } = useAppStore();

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {ORDEN_DIAS.map((dia) => {
        const clasesDelDia = clases.filter((c) => c.dia === dia);
        if (clasesDelDia.length === 0) return null;
        return (
          <div key={dia} className="flex flex-col gap-3">
            <h3 className="font-medium">{ETIQUETA_DIA[dia]}</h3>
            {clasesDelDia.map((clase) => {
              const libres = plazasLibres(clase, reservas);
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
                        <Button variant="outline" size="sm" onClick={() => cancelarReserva(miReserva.id)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => reservarClase(clase.id, clienteId)}>
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
  );
}
