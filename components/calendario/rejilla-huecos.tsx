"use client";

import { useState, useTransition } from "react";
import { PlusIcon, CopyIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usuarioPorId } from "@/lib/selectors";
import { diasDeSemana, formatearDiaCorto, formatearMes, inicioDeSemana, mismoMes, numeroDeDia, sumarDias } from "@/lib/fechas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { copiarSemana } from "@/lib/actions/horarios";
import { eliminarSesion } from "@/lib/actions/sesiones";
import { formatearDiaLargo } from "@/lib/fechas";
import { AbrirHuecoDialogo } from "./abrir-hueco-dialogo";
import type { Clase, Sesion, Reserva, FranjaHoraria, Usuario, DiaSemana } from "@/lib/types";

interface Props {
  hoy: string;
  franjas: FranjaHoraria[];
  clases: Clase[];
  sesiones: Sesion[];
  reservas: Reserva[];
  usuarios: Usuario[];
  puedeAbrir: boolean;
}

// Lunes a sabado: la rejilla del centro no incluye domingo. Mismo orden que
// diasDeSemana(fecha) devuelve, asi que sus primeras 6 fechas se corresponden
// una a una con este array.
const DIAS_REJILLA: DiaSemana[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

interface CeldaSeleccionada {
  dia: DiaSemana;
  fecha: string;
  franja: FranjaHoraria;
}

// Reutiliza el mismo par de tokens amber que BadgeEstado usa para
// "lista_espera" / "pendiente": aqui significa "esto es excepcional, mira dos
// veces antes de asumir que se repite".
const ESTILO_FIJA = "bg-card text-foreground ring-1 ring-foreground/10";
const ESTILO_PUNTUAL = "bg-amber-950/50 text-amber-300 ring-1 ring-amber-800/60";
const ESTILO_HUECO_ABRIBLE =
  "bg-muted/60 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground hover:ring-1 hover:ring-primary/30";
const ESTILO_HUECO_CERRADO = "bg-muted/40 text-muted-foreground/40";

// formatearRangoSemana (lib/fechas.ts) da un rango de lunes a domingo; esta
// rejilla solo pinta hasta el sabado, asi que reusarla diria un dia de mas.
// Se compone a mano con las mismas piezas exportadas (numeroDeDia,
// formatearMes, mismoMes) en vez de tocar fechas.ts para un caso tan
// especifico de esta pantalla.
function etiquetaSemanaLaboral(fechasDeLaSemana: string[]): string {
  const lunes = fechasDeLaSemana[0];
  const sabado = fechasDeLaSemana[5];
  if (mismoMes(lunes, sabado)) {
    return `${numeroDeDia(lunes)} - ${numeroDeDia(sabado)} ${formatearMes(sabado)}`;
  }
  return `${numeroDeDia(lunes)} ${formatearMes(lunes)} - ${numeroDeDia(sabado)} ${formatearMes(sabado)}`;
}

interface SesionParaEliminar {
  sesionId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

export function RejillaHuecos({ hoy, franjas, clases, sesiones, reservas, usuarios, puedeAbrir }: Props) {
  const [fecha, setFecha] = useState(hoy);
  const [celda, setCelda] = useState<CeldaSeleccionada | null>(null);
  const [aEliminar, setAEliminar] = useState<SesionParaEliminar | null>(null);
  const [copiando, startTransition] = useTransition();
  const [eliminando, startEliminarTransition] = useTransition();
  const { toast } = useToast();

  function confirmarEliminar() {
    if (!aEliminar) return;
    const sesionId = aEliminar.sesionId;
    startEliminarTransition(async () => {
      const respuesta = await eliminarSesion(sesionId);
      if (respuesta.error) {
        toast(respuesta.error, "error");
        return;
      }
      toast("Sesion eliminada", "success");
      setAEliminar(null);
    });
  }

  const fechasDeLaSemana = diasDeSemana(fecha).slice(0, 6);

  // No tiene sentido dejar abrir (ni siquiera navegar a mirar) una semana que
  // ya paso: un hueco no se puede borrar ni editar una vez creado, asi que
  // abrir uno en el pasado dejaria una clase fantasma sin forma de deshacerla
  // desde la UI.
  const semanaMasAntiguaVisible = inicioDeSemana(fecha) <= inicioDeSemana(hoy);

  function irASemanaAnterior() {
    if (semanaMasAntiguaVisible) return;
    setFecha(sumarDias(fecha, -7));
  }

  // copiar_semana solo copia sesiones de clases recurrentes (el horario
  // fijo); las puntuales las ignora. Si la semana mostrada no tiene ninguna
  // sesion fija, la copia siempre va a crear cero — no porque el destino ya
  // estuviera copiado, sino porque el origen no tiene nada que copiar. Sin
  // esta distincion, navegar mas alla de las semanas que sembro el seed (sin
  // limite superior) haria que "cero creadas" se leyera como "la semana
  // siguiente ya existe" cuando en realidad ninguna de las dos existe: justo
  // el calendario vacio y silencioso que este boton se anadio para evitar.
  const semanaOrigenTieneSesionesFijas = fechasDeLaSemana.some((f) =>
    sesiones.some((s) => s.fecha === f && clases.find((c) => c.id === s.claseId)?.recurrente)
  );

  // fechasDeLaSemana[0] ya es inicioDeSemana(fecha) (diasDeSemana lo calcula
  // asi internamente), y sumarDias(x, 7) siempre cae 7 dias despues: el
  // desfase que copiar_semana exige (multiplo positivo de 7) queda
  // garantizado sin volver a derivar fechas.
  function copiarSemanaSiguiente() {
    const origen = fechasDeLaSemana[0];
    const destino = sumarDias(origen, 7);
    startTransition(async () => {
      const respuesta = await copiarSemana(origen, destino);
      if (respuesta.error) {
        toast(respuesta.error, "error");
        return;
      }
      const creadas = respuesta.sesionesCreadas ?? 0;
      if (creadas === 0) {
        toast("La semana siguiente ya estaba copiada: no se creo nada nuevo.", "info");
      } else {
        toast(
          `Semana siguiente copiada: ${creadas} sesion${creadas === 1 ? "" : "es"} creada${creadas === 1 ? "" : "s"}. Nadie queda apuntado: cada clienta reserva su plaza.`,
          "success"
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Horario fijo del centro</h3>
          <p className="text-xs text-muted-foreground">
            Es la plantilla del horario fijo, no las reservas de esta semana — eso lo muestra el calendario de arriba. La
            semana elegida aqui solo decide en que fecha se abriria un hueco.
          </p>
          <p className="text-xs text-muted-foreground">
            {puedeAbrir ? "Toca un hueco en gris para abrirlo." : "Vista de solo lectura."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={irASemanaAnterior}
            disabled={semanaMasAntiguaVisible}
            aria-label="Semana anterior"
          >
            ←
          </Button>
          <span className="text-sm text-muted-foreground">{etiquetaSemanaLaboral(fechasDeLaSemana)}</span>
          <Button variant="outline" size="sm" onClick={() => setFecha(sumarDias(fecha, 7))} aria-label="Semana siguiente">
            →
          </Button>
          {puedeAbrir && (
            <Button
              variant="secondary"
              size="sm"
              onClick={copiarSemanaSiguiente}
              disabled={copiando || !semanaOrigenTieneSesionesFijas}
              title="Copia el horario fijo de esta semana a la siguiente: solo crea las horas (las clases puntuales no se copian). No apunta a nadie, cada clienta reserva su plaza. Repetirlo no duplica nada."
            >
              <CopyIcon className="size-3.5" />
              {copiando ? "Copiando..." : "Copiar semana"}
            </Button>
          )}
        </div>
      </div>

      {puedeAbrir && (
        <p className="text-xs text-muted-foreground">
          {semanaOrigenTieneSesionesFijas
            ? "Copiar la semana solo crea las horas del horario fijo (las clases puntuales no se copian); no apunta a nadie, cada clienta reserva su plaza."
            : "Esta semana no tiene sesiones fijas: no hay nada que copiar a la siguiente."}
        </p>
      )}

      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-[3.5rem_repeat(6,1fr)] gap-1">
          <span />
          {DIAS_REJILLA.map((dia, idx) => (
            <span
              key={dia}
              className={cn(
                "text-center text-xs font-medium text-muted-foreground",
                fechasDeLaSemana[idx] === hoy && "text-foreground"
              )}
            >
              {formatearDiaCorto(fechasDeLaSemana[idx])} {numeroDeDia(fechasDeLaSemana[idx])}
            </span>
          ))}

          {franjas.map((franja) => (
            <div key={franja.id} className="contents">
              <span className="flex items-center text-[11px] text-muted-foreground tabular-nums">{franja.horaInicio}</span>
              {DIAS_REJILLA.map((dia, idx) => {
                const fechaDia = fechasDeLaSemana[idx];

                const claseFija = clases.find((c) => c.recurrente && c.dia === dia && c.horaInicio === franja.horaInicio);

                const sesionPuntual = !claseFija
                  ? sesiones.find((s) => {
                      if (s.fecha !== fechaDia) return false;
                      const c = clases.find((cl) => cl.id === s.claseId);
                      return Boolean(c && !c.recurrente && c.horaInicio === franja.horaInicio);
                    })
                  : undefined;
                const clasePuntual = sesionPuntual ? clases.find((c) => c.id === sesionPuntual.claseId) : undefined;

                if (claseFija) {
                  const entrenador = usuarioPorId(usuarios, claseFija.entrenadorId);
                  const sesion = sesiones.find((s) => s.claseId === claseFija.id && s.fecha === fechaDia);
                  const sinReservasActivas = Boolean(
                    sesion && !reservas.some((r) => r.sesionId === sesion.id && r.estado !== "cancelada")
                  );
                  const puedeEliminar = puedeAbrir && Boolean(sesion) && sinReservasActivas;
                  return (
                    <div
                      key={dia}
                      role={puedeEliminar ? "button" : undefined}
                      tabIndex={puedeEliminar ? 0 : undefined}
                      title={
                        puedeEliminar
                          ? "Toca para eliminar esta sesion"
                          : `Clase fija, ${entrenador?.nombre ?? "sin entrenador"}`
                      }
                      onClick={
                        puedeEliminar
                          ? () =>
                              setAEliminar({
                                sesionId: sesion!.id,
                                fecha: fechaDia,
                                horaInicio: franja.horaInicio,
                                horaFin: franja.horaFin,
                              })
                          : undefined
                      }
                      className={cn(
                        "flex items-center justify-center rounded-md px-1 py-1.5 text-center text-[11px]",
                        ESTILO_FIJA,
                        puedeEliminar && "cursor-pointer transition-colors hover:bg-destructive/10 hover:ring-1 hover:ring-destructive/40"
                      )}
                    >
                      {entrenador?.nombre.split(" ")[0] ?? "—"}
                    </div>
                  );
                }

                if (clasePuntual) {
                  const entrenador = usuarioPorId(usuarios, clasePuntual.entrenadorId);
                  const sinReservasActivas = Boolean(
                    sesionPuntual && !reservas.some((r) => r.sesionId === sesionPuntual.id && r.estado !== "cancelada")
                  );
                  const puedeEliminar = puedeAbrir && Boolean(sesionPuntual) && sinReservasActivas;
                  return (
                    <div
                      key={dia}
                      role={puedeEliminar ? "button" : undefined}
                      tabIndex={puedeEliminar ? 0 : undefined}
                      title={
                        puedeEliminar
                          ? "Toca para eliminar esta sesion"
                          : `Abierta solo este dia, ${entrenador?.nombre ?? "sin entrenador"}`
                      }
                      onClick={
                        puedeEliminar
                          ? () =>
                              setAEliminar({
                                sesionId: sesionPuntual!.id,
                                fecha: fechaDia,
                                horaInicio: franja.horaInicio,
                                horaFin: franja.horaFin,
                              })
                          : undefined
                      }
                      className={cn(
                        "flex flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-center text-[11px]",
                        ESTILO_PUNTUAL,
                        puedeEliminar && "cursor-pointer transition-colors hover:ring-1 hover:ring-destructive/40"
                      )}
                    >
                      <span>{entrenador?.nombre.split(" ")[0] ?? "—"}</span>
                      <span className="text-[9px] uppercase tracking-wide opacity-80">Puntual</span>
                    </div>
                  );
                }

                // Un dia ya pasado no se puede abrir: la clase quedaria en el
                // horario sin sesion util, y no hay forma de deshacerla desde
                // la UI.
                if (puedeAbrir && fechaDia >= hoy) {
                  return (
                    <button
                      key={dia}
                      type="button"
                      title="Hueco: toca para abrirlo"
                      onClick={() => setCelda({ dia, fecha: fechaDia, franja })}
                      className={cn("flex items-center justify-center rounded-md px-1 py-1.5", ESTILO_HUECO_ABRIBLE)}
                    >
                      <PlusIcon className="size-3.5" />
                    </button>
                  );
                }

                return (
                  <div key={dia} className={cn("flex items-center justify-center rounded-md px-1 py-1.5", ESTILO_HUECO_CERRADO)}>
                    —
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm", ESTILO_FIJA)} /> Clase fija
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-amber-950/50 ring-1 ring-amber-800/60" /> Abierta puntualmente
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-muted" /> Hueco
        </span>
      </div>

      {celda && (
        <AbrirHuecoDialogo
          dia={celda.dia}
          fecha={celda.fecha}
          horaInicio={celda.franja.horaInicio}
          horaFin={celda.franja.horaFin}
          usuarios={usuarios}
          onCerrar={() => setCelda(null)}
        />
      )}

      {aEliminar && (
        <Dialog open onOpenChange={(abierto) => !abierto && setAEliminar(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Eliminar la clase de {aEliminar.horaInicio} a {aEliminar.horaFin}
              </DialogTitle>
              <DialogDescription>{formatearDiaLargo(aEliminar.fecha)}</DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Solo se borra esta sesion concreta (para un festivo o un ajuste puntual). Si es una clase del horario
              fijo, el resto de semanas no cambia.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAEliminar(null)} disabled={eliminando}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmarEliminar} disabled={eliminando}>
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
