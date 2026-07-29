import type { Usuario, Cliente, Plan, Clase, Reserva, Pago, BonoCliente, DiaSemana } from "./types";

export const ORDEN_DIAS: DiaSemana[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

export function usuarioPorId(usuarios: Usuario[], id: string): Usuario | undefined {
  return usuarios.find((u) => u.id === id);
}

export function clientePorId(clientes: Cliente[], id: string): Cliente | undefined {
  return clientes.find((c) => c.id === id);
}

export function planPorId(planes: Plan[], id: string): Plan | undefined {
  return planes.find((p) => p.id === id);
}

export function reservasConfirmadasDeClase(reservas: Reserva[], claseId: string): Reserva[] {
  return reservas.filter((r) => r.claseId === claseId && r.estado === "confirmada");
}

export function reservasListaEsperaDeClase(reservas: Reserva[], claseId: string): Reserva[] {
  return reservas.filter((r) => r.claseId === claseId && r.estado === "lista_espera");
}

export function plazasLibres(clase: Clase, reservas: Reserva[]): number {
  return clase.aforoMax - reservasConfirmadasDeClase(reservas, clase.id).length;
}

export function bonoDeCliente(bonos: BonoCliente[], clienteId: string): BonoCliente | undefined {
  return bonos.find((b) => b.clienteId === clienteId && b.activo);
}

export function creditosRestantes(bono: BonoCliente): number {
  return bono.creditosTotales - bono.creditosUsados;
}

export function pagoDeCliente(pagos: Pago[], clienteId: string): Pago | undefined {
  return pagos.find((p) => p.clienteId === clienteId);
}

export function reservaActivaDeClienteEnClase(reservas: Reserva[], clienteId: string, claseId: string): Reserva | undefined {
  return reservas.find((r) => r.clienteId === clienteId && r.claseId === claseId && r.estado !== "cancelada");
}
