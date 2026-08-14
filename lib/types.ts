export type Rol = "admin" | "entrenador" | "cliente";
export type DiaSemana = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";
export type EstadoCliente = "activo" | "baja";
export type TipoPlan = "mensual" | "bono";
export type EstadoReserva = "confirmada" | "lista_espera" | "cancelada";
export type EstadoAsistencia = "pendiente" | "asistio" | "no_asistio";
export type TipoBono = "normal" | "recuperacion";
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
  // Un plan retirado (precio antiguo) sigue siendo un id valido para las
  // clientas que ya lo tenian; solo deja de ofrecerse en las altas nuevas.
  activo: boolean;
}

export interface Cliente {
  id: string;
  usuarioId: string;
  estado: EstadoCliente;
  planId: string;
  notasRutina: string;
  diasSemanaHabituales: number;
  deudaCreditos: number;
  // null = sin restriccion, la clienta ve las clases de cualquier entrenador.
  entrenadorRestringidoId: string | null;
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

export interface Sesion {
  id: string;
  claseId: string;
  fecha: string;
  aforoEfectivo: number | null;
  abierta: boolean;
  createdAt: string;
}

export interface FranjaHoraria {
  id: string;
  horaInicio: string;
  horaFin: string;
  orden: number;
}

export interface Reserva {
  id: string;
  sesionId: string;
  clienteId: string;
  estado: EstadoReserva;
  asistencia: EstadoAsistencia;
  canceladaEn: string | null;
  createdAt: string;
  // Bono al que se le desconto un credito al confirmar esta reserva; null si
  // la clienta es de mensualidad, si quedo en lista de espera, o si nunca
  // llego a confirmarse.
  bonoId: string | null;
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
  planId: string | null;
  tipo: TipoBono;
  creditosTotales: number;
  creditosUsados: number;
  fechaCompra: string;
  fechaCaducidad: string | null;
  activo: boolean;
}

export interface MovimientoHistorial {
  id: string;
  reservaId: string;
  sesionId: string;
  clienteId: string;
  evento: string;
  creadoEn: string;
}
