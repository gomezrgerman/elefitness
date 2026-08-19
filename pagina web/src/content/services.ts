import type { Service } from "@/types";

// Solo estas dos modalidades son reales (confirmado por German, 2026-08-19):
// entrenamiento individual y entrenamiento personal en grupo reducido. Dentro
// de las dos caben perfiles distintos (mayores de 50, fuerza, etc.), pero no
// son modalidades aparte -- textos pendientes de afinar con Elena.
export const services: Service[] = [
  {
    id: "entrenamiento-personal",
    number: "01",
    name: "Entrenamiento personal",
    description:
      "Sesiones individuales, con un plan pensado solo para ti: tu nivel, tus objetivos y tu ritmo de progreso.",
  },
  {
    id: "entrenamiento-grupal",
    number: "02",
    name: "Entrenamiento personal en grupo reducido",
    description:
      "El mismo seguimiento cercano, entrenando en compañía. Cada plan se adapta a cada persona del grupo, sea cual sea su nivel o su edad.",
  },
];
