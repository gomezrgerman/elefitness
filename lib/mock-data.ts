import type { Centro, Usuario, Plan, Clase, Cliente, Reserva, Pago, BonoCliente } from "./types";

export const centro: Centro = {
  id: "centro-1",
  nombre: "Elefitness",
  logoUrl: null,
  colorMarca: "#16A34A",
};

export const usuarios: Usuario[] = [
  { id: "u-elena", email: "elena@elefitness.com", rol: "admin", nombre: "Elena", telefono: "600111222" },
  { id: "u-ivan", email: "ivan@elefitness.com", rol: "entrenador", nombre: "Ivan", telefono: "600333444" },
  { id: "u-maria", email: "maria@example.com", rol: "cliente", nombre: "Maria Lopez", telefono: "600555001" },
  { id: "u-laura", email: "laura@example.com", rol: "cliente", nombre: "Laura Fernandez", telefono: "600555002" },
  { id: "u-sara", email: "sara@example.com", rol: "cliente", nombre: "Sara Gimenez", telefono: "600555003" },
  { id: "u-ana", email: "ana@example.com", rol: "cliente", nombre: "Ana Ruiz", telefono: "600555004" },
  { id: "u-beatriz", email: "beatriz@example.com", rol: "cliente", nombre: "Beatriz Soto", telefono: "600555005" },
  { id: "u-carla", email: "carla@example.com", rol: "cliente", nombre: "Carla Vidal", telefono: "600555006" },
  { id: "u-diana", email: "diana@example.com", rol: "cliente", nombre: "Diana Ortiz", telefono: "600555007" },
  { id: "u-eva", email: "eva@example.com", rol: "cliente", nombre: "Eva Molina", telefono: "600555008" },
];

// Las clientas que se seleccionan desde el selector de rol (/) como
// "clientas de ejemplo" curadas del brief. Ana/Beatriz/Carla/Diana/Eva
// existen solo para llenar el aforo de clase-miercoles (ver mas abajo) y
// no aparecen en el selector.
export const usuarioIdsClientesDestacados = ["u-maria", "u-laura", "u-sara"];

export const planes: Plan[] = [
  { id: "plan-mensual", nombre: "Cuota mensual", precio: 45, tipo: "mensual", clasesIncluidas: null },
  { id: "plan-bono10", nombre: "Bono 10 clases", precio: 80, tipo: "bono", clasesIncluidas: 10 },
];

export const clases: Clase[] = [
  { id: "clase-lunes", dia: "lunes", horaInicio: "18:00", horaFin: "19:00", aforoMax: 5, entrenadorId: "u-ivan", recurrente: true },
  { id: "clase-miercoles", dia: "miercoles", horaInicio: "19:00", horaFin: "20:00", aforoMax: 5, entrenadorId: "u-ivan", recurrente: true },
];

// Ana/Beatriz/Carla/Diana/Eva son relleno para dejar clase-miercoles con
// el aforo completo (5/5) y poder demostrar que Laura pasa a lista de
// espera, tal y como pide el escenario de seeds de Claude.MD. No son
// parte de los 3 clientes de ejemplo curados (Maria, Laura, Sara).
export const clientesSeed: Cliente[] = [
  { id: "c-maria", usuarioId: "u-maria", estado: "activo", planId: "plan-mensual", notasRutina: "Full body 3x/semana, foco en tren inferior. Progresar sentadilla goblet.", createdAt: "2026-02-10" },
  { id: "c-laura", usuarioId: "u-laura", estado: "activo", planId: "plan-bono10", notasRutina: "Circuito funcional, cuidado con el hombro derecho.", createdAt: "2026-04-02" },
  { id: "c-sara", usuarioId: "u-sara", estado: "activo", planId: "plan-mensual", notasRutina: "Readaptacion tras baja, sin saltos todavia.", createdAt: "2026-01-15" },
  { id: "c-ana", usuarioId: "u-ana", estado: "activo", planId: "plan-mensual", notasRutina: "", createdAt: "2026-03-01" },
  { id: "c-beatriz", usuarioId: "u-beatriz", estado: "activo", planId: "plan-mensual", notasRutina: "", createdAt: "2026-03-01" },
  { id: "c-carla", usuarioId: "u-carla", estado: "activo", planId: "plan-mensual", notasRutina: "", createdAt: "2026-03-01" },
  { id: "c-diana", usuarioId: "u-diana", estado: "activo", planId: "plan-mensual", notasRutina: "", createdAt: "2026-03-01" },
  { id: "c-eva", usuarioId: "u-eva", estado: "activo", planId: "plan-mensual", notasRutina: "", createdAt: "2026-03-01" },
];

export const reservasSeed: Reserva[] = [
  { id: "r-maria-lunes", claseId: "clase-lunes", clienteId: "c-maria", estado: "confirmada", createdAt: "2026-07-20" },
  { id: "r-ana-miercoles", claseId: "clase-miercoles", clienteId: "c-ana", estado: "confirmada", createdAt: "2026-07-18" },
  { id: "r-beatriz-miercoles", claseId: "clase-miercoles", clienteId: "c-beatriz", estado: "confirmada", createdAt: "2026-07-18" },
  { id: "r-carla-miercoles", claseId: "clase-miercoles", clienteId: "c-carla", estado: "confirmada", createdAt: "2026-07-19" },
  { id: "r-diana-miercoles", claseId: "clase-miercoles", clienteId: "c-diana", estado: "confirmada", createdAt: "2026-07-19" },
  { id: "r-eva-miercoles", claseId: "clase-miercoles", clienteId: "c-eva", estado: "confirmada", createdAt: "2026-07-20" },
  { id: "r-laura-miercoles", claseId: "clase-miercoles", clienteId: "c-laura", estado: "lista_espera", createdAt: "2026-07-21" },
];

export const pagosSeed: Pago[] = [
  { id: "p-maria", clienteId: "c-maria", planId: "plan-mensual", tipo: "mensual", metodo: "stripe", estado: "al_dia", importe: 45, fechaPago: "2026-07-01", ultimoCobro: "2026-07-01", proximoCobro: "2026-08-01", registradoPor: "u-elena" },
  { id: "p-laura", clienteId: "c-laura", planId: "plan-bono10", tipo: "bono", metodo: "efectivo", estado: "al_dia", importe: 80, fechaPago: "2026-04-02", ultimoCobro: "2026-04-02", proximoCobro: null, registradoPor: "u-elena" },
  { id: "p-sara", clienteId: "c-sara", planId: "plan-mensual", tipo: "mensual", metodo: "stripe", estado: "moroso", importe: 45, fechaPago: "2026-06-01", ultimoCobro: "2026-06-01", proximoCobro: "2026-07-01", registradoPor: "u-elena" },
];

// Laura ya gasto 1 credito en una clase confirmada anterior (no
// modelada aqui por brevedad); su reserva del miercoles esta en lista
// de espera porque la clase ya estaba llena cuando la pidio.
export const bonosClienteSeed: BonoCliente[] = [
  { id: "b-laura", clienteId: "c-laura", planId: "plan-bono10", creditosTotales: 10, creditosUsados: 1, fechaCompra: "2026-04-02", activo: true },
];
