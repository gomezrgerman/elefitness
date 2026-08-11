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
