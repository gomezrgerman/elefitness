import type { Rol } from "./types";

export const DEMO_PASSWORD = "Elefitness2026!";

export const DEMO_ACCOUNTS: { email: string; nombre: string; rol: Rol }[] = [
  { email: "elena@elefitness.com", nombre: "Elena", rol: "admin" },
  { email: "ivan@elefitness.com", nombre: "Ivan", rol: "entrenador" },
  { email: "maria@example.com", nombre: "Maria Lopez", rol: "cliente" },
  { email: "laura@example.com", nombre: "Laura Fernandez", rol: "cliente" },
  { email: "sara@example.com", nombre: "Sara Gimenez", rol: "cliente" },
];
