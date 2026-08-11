// Toda la aritmetica de calendario opera sobre cadenas YYYY-MM-DD y construye
// las fechas al mediodia UTC. Asi ningun cambio de hora ni diferencia de zona
// puede desplazar el dia, que es el error clasico al hacer esto con Date.

const ETIQUETAS_DIA = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
const ETIQUETAS_DIA_CORTO = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const ETIQUETAS_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function aDate(fecha: string): Date {
  return new Date(`${fecha}T12:00:00Z`);
}

// `new Date().toISOString().slice(0, 10)` da el dia de hoy en UTC, no en
// Espana: entre medianoche y la 1-2 de la manana en horario local, UTC todavia
// va por el dia anterior y esa expresion devuelve la fecha equivocada. Esta
// funcion resuelve "hoy" en la zona del centro para que ese margen no se cuele
// en calendarios, filtros de vigencia ni fechas que se guardan en la base.
export function hoyEnEspana(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

// `clase.horaInicio` se guarda como hora de pared de Espana (asi la escriben
// Elena e Ivan), no UTC. Un offset fijo (+1 o +2) no vale: Espana alterna entre
// CET y CEST segun la epoca del anyo, asi que la misma hora de pared cae en
// instantes distintos en enero y en agosto. Para saber a que instante real
// corresponde "10:00 en Madrid" en una fecha dada hace falta preguntarle a la
// zona horaria, no sumar una constante.
//
// Se resuelve en dos pasos: primero se interpreta la hora de pared como si
// fuera UTC (una aproximacion a menos de un dia del instante real); despues se
// formatea esa aproximacion en Europe/Madrid para leer el offset que estaba en
// vigor ese dia, y se resta para llegar al instante real. El offset no cambia
// dentro del margen de horas que introduce la aproximacion salvo en el propio
// instante del cambio de hora (de madrugada, fuera del horario de clases), que
// queda fuera de alcance aqui.
export function instanteEnEspana(fecha: string, hora: string): Date {
  const [anyo, mes, dia] = fecha.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  const aproximacion = new Date(Date.UTC(anyo, mes - 1, dia, h, m, 0));

  const formateador = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const partes = Object.fromEntries(formateador.formatToParts(aproximacion).map((p) => [p.type, p.value]));
  const comoUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute)
  );
  const offsetMinutos = (comoUtc - aproximacion.getTime()) / 60000;

  return new Date(aproximacion.getTime() - offsetMinutos * 60000);
}

function aCadena(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  const d = aDate(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return aCadena(d);
}

export function sumarMeses(fecha: string, meses: number): string {
  const d = aDate(fecha);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  return aCadena(d);
}

// La semana empieza en lunes.
export function inicioDeSemana(fecha: string): string {
  const d = aDate(fecha);
  const desplazamiento = (d.getUTCDay() + 6) % 7;
  return sumarDias(fecha, -desplazamiento);
}

export function diasDeSemana(fecha: string): string[] {
  const lunes = inicioDeSemana(fecha);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

export function diasDeMes(fecha: string): string[] {
  const d = aDate(fecha);
  const anyo = d.getUTCFullYear();
  const mes = d.getUTCMonth();
  const total = new Date(Date.UTC(anyo, mes + 1, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => aCadena(new Date(Date.UTC(anyo, mes, i + 1, 12))));
}

// Huecos vacios antes del dia 1 para que la rejilla del mes empiece en lunes.
export function huecosIniciales(fecha: string): number {
  const primero = diasDeMes(fecha)[0];
  return (aDate(primero).getUTCDay() + 6) % 7;
}

export function mismoMes(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function numeroDeDia(fecha: string): number {
  return aDate(fecha).getUTCDate();
}

export function formatearDiaCorto(fecha: string): string {
  return ETIQUETAS_DIA_CORTO[aDate(fecha).getUTCDay()];
}

export function formatearDiaLargo(fecha: string): string {
  const d = aDate(fecha);
  return `${ETIQUETAS_DIA[d.getUTCDay()]} ${d.getUTCDate()} de ${ETIQUETAS_MES[d.getUTCMonth()]}`;
}

export function formatearMes(fecha: string): string {
  const d = aDate(fecha);
  return `${ETIQUETAS_MES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatearRangoSemana(fecha: string): string {
  const dias = diasDeSemana(fecha);
  const primero = aDate(dias[0]);
  const ultimo = aDate(dias[6]);
  return `${primero.getUTCDate()} ${ETIQUETAS_MES[primero.getUTCMonth()]} – ${ultimo.getUTCDate()} ${ETIQUETAS_MES[ultimo.getUTCMonth()]}`;
}
