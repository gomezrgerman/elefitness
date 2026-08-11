// Escala de color compartida para representar la ocupacion de una clase o de
// un dia entero: primario cuando hay margen, ambar cerca del aforo, rojo al
// completo. La misma escala alimenta la barra de ocupacion (vista de dia y
// semana) y el color de fondo de las celdas del mes, para que "rojo" y
// "ambar" signifiquen siempre lo mismo en toda la app en vez de tener dos
// lecturas de color distintas conviviendo en el calendario.
export function ratioOcupacion(ocupados: number, aforo: number): number {
  if (aforo <= 0) return 0;
  return ocupados / aforo;
}

export function colorBarraOcupacion(ocupados: number, aforo: number): string {
  const ratio = ratioOcupacion(ocupados, aforo);
  if (ratio >= 1) return "bg-red-500/60";
  if (ratio >= 0.8) return "bg-amber-500/60";
  return "bg-primary";
}

export function colorCeldaOcupacion(ocupados: number, aforo: number): string {
  if (aforo <= 0) return "";
  const ratio = ratioOcupacion(ocupados, aforo);
  if (ratio >= 1) return "bg-red-500/15";
  if (ratio >= 0.8) return "bg-amber-500/15";
  return "bg-primary/10";
}
