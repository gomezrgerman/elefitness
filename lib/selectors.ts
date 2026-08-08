import type { Usuario, Cliente, Plan, Clase, Sesion, Reserva, Pago, BonoCliente, DiaSemana } from "./types";

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

export function reservasConfirmadasDeSesion(reservas: Reserva[], sesionId: string): Reserva[] {
  return reservas.filter((r) => r.sesionId === sesionId && r.estado === "confirmada");
}

export function reservasListaEsperaDeSesion(reservas: Reserva[], sesionId: string): Reserva[] {
  return reservas.filter((r) => r.sesionId === sesionId && r.estado === "lista_espera");
}

export function plazasLibres(sesion: Sesion, clase: Clase, reservas: Reserva[]): number {
  const aforo = sesion.aforoEfectivo ?? clase.aforoMax;
  return aforo - reservasConfirmadasDeSesion(reservas, sesion.id).length;
}

// Mismo criterio que reservar_sesion en Postgres: de los bonos vigentes se
// elige el de caducidad mas proxima **que aun tenga creditos**, que es el que
// la RPC va a cobrar en la siguiente reserva. Sin el filtro de creditos la
// pantalla ensenaba "0 de 1" a una clienta que si tenia creditos en otro bono.
// Si ninguno tiene creditos se devuelve el mas proximo a caducar igualmente,
// para poder seguir mostrando el saldo agotado en vez de nada.
export function bonoDeCliente(bonos: BonoCliente[], clienteId: string): BonoCliente | undefined {
  const hoy = new Date().toISOString().slice(0, 10);
  const vigentes = bonos
    .filter((b) => b.clienteId === clienteId && b.activo && (!b.fechaCaducidad || b.fechaCaducidad >= hoy))
    .sort((a, b) => (a.fechaCaducidad ?? "9999-12-31").localeCompare(b.fechaCaducidad ?? "9999-12-31"));
  return vigentes.find((b) => creditosRestantes(b) > 0) ?? vigentes[0];
}

export function creditosRestantes(bono: BonoCliente): number {
  return bono.creditosTotales - bono.creditosUsados;
}

export function pagoDeCliente(pagos: Pago[], clienteId: string): Pago | undefined {
  return pagos.find((p) => p.clienteId === clienteId);
}

export function reservaActivaDeClienteEnSesion(reservas: Reserva[], clienteId: string, sesionId: string): Reserva | undefined {
  return reservas.find((r) => r.clienteId === clienteId && r.sesionId === sesionId && r.estado !== "cancelada");
}
