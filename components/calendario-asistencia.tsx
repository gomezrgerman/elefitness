import { cn } from "@/lib/utils";
import { hoyEnEspana, sumarDias, inicioDeSemana, formatearDiaLargo, formatearMes } from "@/lib/fechas";
import type { Reserva, Sesion } from "@/lib/types";

const DIAS_LABEL = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type EstadoDia = "asistio" | "no_asistio" | "pendiente";

// Prioridad para el caso raro de mas de una clase el mismo dia: haber
// asistido a alguna pesa mas que haber faltado a otra, que a su vez pesa mas
// que dejarla sin marcar.
const PRIORIDAD: Record<EstadoDia, number> = { asistio: 2, no_asistio: 1, pendiente: 0 };

const ESTILOS: Record<EstadoDia, string> = {
  asistio: "bg-emerald-600",
  no_asistio: "bg-red-600",
  pendiente: "bg-zinc-700",
};

const ETIQUETAS: Record<EstadoDia, string> = {
  asistio: "Asistió",
  no_asistio: "Faltó",
  pendiente: "Reservada, sin marcar",
};

interface Props {
  reservas: Reserva[];
  sesiones: Sesion[];
  semanas?: number;
}

export function CalendarioAsistencia({ reservas, sesiones, semanas = 24 }: Props) {
  const hoy = hoyEnEspana();
  const sesionPorId = new Map(sesiones.map((s) => [s.id, s]));

  const estadoPorFecha = new Map<string, EstadoDia>();
  for (const reserva of reservas) {
    if (reserva.estado !== "confirmada") continue;
    const sesion = sesionPorId.get(reserva.sesionId);
    if (!sesion || sesion.fecha > hoy) continue;

    const nuevo: EstadoDia =
      reserva.asistencia === "asistio" ? "asistio" : reserva.asistencia === "no_asistio" ? "no_asistio" : "pendiente";
    const actual = estadoPorFecha.get(sesion.fecha);
    if (!actual || PRIORIDAD[nuevo] > PRIORIDAD[actual]) {
      estadoPorFecha.set(sesion.fecha, nuevo);
    }
  }

  if (estadoPorFecha.size === 0) {
    return <p className="text-sm text-muted-foreground">Sin asistencia registrada todavía.</p>;
  }

  const finGrid = inicioDeSemana(hoy);
  const inicioGrid = sumarDias(finGrid, -(semanas - 1) * 7);
  const columnas = Array.from({ length: semanas }, (_, i) => {
    const lunes = sumarDias(inicioGrid, i * 7);
    return Array.from({ length: 7 }, (_, j) => sumarDias(lunes, j));
  });

  let totalAsistio = 0;
  let totalFalto = 0;
  for (const estado of estadoPorFecha.values()) {
    if (estado === "asistio") totalAsistio += 1;
    if (estado === "no_asistio") totalFalto += 1;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto pb-1">
        <div className="flex w-max gap-1">
          <div className="flex flex-col justify-between gap-1 pr-1 pt-[18px]">
            {DIAS_LABEL.map((dia) => (
              <span key={dia} className="block h-3 text-[10px] leading-3 text-muted-foreground">
                {dia}
              </span>
            ))}
          </div>
          {columnas.map((columna, i) => {
            const primerDiaDeMes = columna.find((fecha) => fecha.endsWith("-01"));
            return (
              <div key={i} className="flex flex-col gap-1">
                <span className="block h-3 text-[10px] leading-3 whitespace-nowrap text-muted-foreground">
                  {primerDiaDeMes ? formatearMes(primerDiaDeMes).slice(0, 3) : ""}
                </span>
                {columna.map((fecha) => {
                  const estado = estadoPorFecha.get(fecha);
                  const esFuturo = fecha > hoy;
                  return (
                    <div
                      key={fecha}
                      title={`${formatearDiaLargo(fecha)}${estado ? `: ${ETIQUETAS[estado]}` : ""}`}
                      className={cn("size-3 rounded-[3px]", esFuturo ? "invisible" : estado ? ESTILOS[estado] : "bg-muted")}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span>{totalAsistio} asistencias</span>
        <span>{totalFalto} faltas</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="size-3 rounded-[3px] bg-emerald-600" /> Asistió
          </span>
          <span className="flex items-center gap-1">
            <span className="size-3 rounded-[3px] bg-red-600" /> Faltó
          </span>
          <span className="flex items-center gap-1">
            <span className="size-3 rounded-[3px] bg-zinc-700" /> Sin marcar
          </span>
          <span className="flex items-center gap-1">
            <span className="size-3 rounded-[3px] bg-muted" /> Sin clase
          </span>
        </div>
      </div>
    </div>
  );
}
