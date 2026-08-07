import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ORDEN_DIAS, reservasConfirmadasDeSesion, reservasListaEsperaDeSesion, usuarioPorId, clientePorId } from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";
import type { Clase, Sesion, Reserva, Cliente, Usuario } from "@/lib/types";

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
  clases: Clase[];
  sesiones: Sesion[];
  reservas: Reserva[];
  clientes: Cliente[];
  usuarios: Usuario[];
}

export function CalendarioSemanal({ clases, sesiones, reservas, clientes, usuarios }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {ORDEN_DIAS.map((dia) => {
        const clasesDelDia = clases.filter((c) => c.dia === dia);
        if (clasesDelDia.length === 0) return null;
        return (
          <div key={dia} className="flex flex-col gap-3">
            <h3 className="font-medium">{ETIQUETA_DIA[dia]}</h3>
            {clasesDelDia.map((clase) => {
              const entrenador = usuarioPorId(usuarios, clase.entrenadorId);
              const sesionesDeClase = sesiones
                .filter((s) => s.claseId === clase.id)
                .sort((a, b) => a.fecha.localeCompare(b.fecha));
              return sesionesDeClase.map((sesion) => {
                const confirmadas = reservasConfirmadasDeSesion(reservas, sesion.id);
                const enEspera = reservasListaEsperaDeSesion(reservas, sesion.id);
                const aforo = sesion.aforoEfectivo ?? clase.aforoMax;
                return (
                  <Card key={sesion.id}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {sesion.fecha} · {clase.horaInicio} - {clase.horaFin}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {entrenador?.nombre} · {confirmadas.length}/{aforo} plazas
                      </p>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 text-sm">
                      {[...confirmadas, ...enEspera].map((reserva) => {
                        const cliente = clientePorId(clientes, reserva.clienteId);
                        const usuario = cliente ? usuarioPorId(usuarios, cliente.usuarioId) : undefined;
                        return (
                          <div key={reserva.id} className="flex items-center justify-between">
                            <span>{usuario?.nombre ?? "—"}</span>
                            <BadgeEstado estado={reserva.estado} />
                          </div>
                        );
                      })}
                      {confirmadas.length === 0 && enEspera.length === 0 && (
                        <p className="text-muted-foreground">Sin reservas todavia</p>
                      )}
                    </CardContent>
                  </Card>
                );
              });
            })}
          </div>
        );
      })}
    </div>
  );
}
