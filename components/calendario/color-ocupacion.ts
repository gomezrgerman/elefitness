// Dos escalas de color distintas y deliberadamente separadas, porque
// responden a preguntas distintas:
//
// - `colorBarraOcupacion` (vista de dia y semana) responde "¿le cabe esta
//   clienta?": primario cuando hay margen, ambar cerca del aforo, rojo al
//   completo. Aqui "rojo" significa "sin hueco", la lectura correcta para
//   quien esta decidiendo si reservar.
//
// - `colorCeldaOcupacion` (vista de mes) responde "¿que tal de carga fue
//   este dia?": una escala de intensidad de un unico color (sin rojo ni
//   ambar, que quedan reservados para el significado de la barra), donde
//   los dias casi vacios apenas se tiñen y los dias llenos destacan mas
//   saturados. Para la dueña un dia lleno es el resultado bueno y un dia
//   vacio es el que le cuesta dinero, asi que el mes tiene que señalar lo
//   contrario de lo que señala la barra.
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
  if (ratio >= 1) return "bg-primary/40";
  if (ratio >= 0.75) return "bg-primary/30";
  if (ratio >= 0.5) return "bg-primary/20";
  if (ratio >= 0.25) return "bg-primary/10";
  return "bg-primary/5";
}
