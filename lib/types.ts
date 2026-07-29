export type Rol = "admin" | "entrenador" | "cliente";
export type DiaSemana = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";
export type EstadoCliente = "activo" | "baja";
export type TipoPlan = "mensual" | "bono";
export type EstadoReserva = "confirmada" | "lista_espera" | "cancelada";
export type MetodoPago = "stripe" | "efectivo" | "transferencia";
export type EstadoPago = "al_dia" | "moroso" | "pendiente";

export interface Centro {
  id: string;
  nombre: string;
  logoUrl: string | null;
  colorMarca: string;
}

export interface Usuario {
  id: string;
  email: string;
  rol: Rol;
  nombre: string;
  telefono: string;
}

export interface Plan {
  id: string;
  nombre: string;
  precio: number;
  tipo: TipoPlan;
  clasesIncluidas: number | null;
}

export interface Cliente {
  id: string;
  usuarioId: string;
  estado: EstadoCliente;
  planId: string;
  notasRutina: string;
  createdAt: string;
}

export interface Clase {
  id: string;
  dia: DiaSemana;
  horaInicio: string;
  horaFin: string;
  aforoMax: number;
  entrenadorId: string;
  recurrente: boolean;
}

export interface Reserva {
  id: string;
  claseId: string;
  clienteId: string;
  estado: EstadoReserva;
  createdAt: string;
}

export interface Pago {
  id: string;
  clienteId: string;
  planId: string;
  tipo: TipoPlan;
  metodo: MetodoPago;
  estado: EstadoPago;
  importe: number;
  fechaPago: string;
  ultimoCobro: string | null;
  proximoCobro: string | null;
  registradoPor: string;
}

export interface BonoCliente {
  id: string;
  clienteId: string;
  planId: string;
  creditosTotales: number;
  creditosUsados: number;
  fechaCompra: string;
  activo: boolean;
}
