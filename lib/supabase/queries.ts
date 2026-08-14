import { createClient } from "@/lib/supabase/server";
import type { Cliente, Usuario, Plan, Clase, Sesion, Reserva, Pago, BonoCliente, MovimientoHistorial, FranjaHoraria } from "@/lib/types";

export async function obtenerClientes(): Promise<Cliente[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select(
      "id, usuario_id, estado, plan_id, notas_rutina, dias_semana_habituales, deuda_creditos, entrenador_restringido_id, created_at"
    );
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    usuarioId: c.usuario_id,
    estado: c.estado,
    planId: c.plan_id,
    notasRutina: c.notas_rutina,
    diasSemanaHabituales: c.dias_semana_habituales,
    deudaCreditos: c.deuda_creditos,
    entrenadorRestringidoId: c.entrenador_restringido_id,
    createdAt: c.created_at,
  }));
}

export async function obtenerClienteDeUsuario(usuarioId: string): Promise<Cliente | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select(
      "id, usuario_id, estado, plan_id, notas_rutina, dias_semana_habituales, deuda_creditos, entrenador_restringido_id, created_at"
    )
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    usuarioId: data.usuario_id,
    estado: data.estado,
    planId: data.plan_id,
    notasRutina: data.notas_rutina,
    diasSemanaHabituales: data.dias_semana_habituales,
    deudaCreditos: data.deuda_creditos,
    entrenadorRestringidoId: data.entrenador_restringido_id,
    createdAt: data.created_at,
  };
}

export async function obtenerUsuarios(): Promise<Usuario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("users").select("id, email, rol, nombre, telefono");
  if (error) throw error;
  return (data ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    rol: u.rol,
    nombre: u.nombre,
    telefono: u.telefono,
  }));
}

export async function obtenerPlanes(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("planes").select("id, nombre, precio, tipo, clases_incluidas, activo");
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    precio: p.precio,
    tipo: p.tipo,
    clasesIncluidas: p.clases_incluidas,
    activo: p.activo,
  }));
}

export async function obtenerClases(): Promise<Clase[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clases")
    .select("id, dia, hora_inicio, hora_fin, aforo_max, entrenador_id, recurrente");
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    dia: c.dia,
    horaInicio: c.hora_inicio.slice(0, 5),
    horaFin: c.hora_fin.slice(0, 5),
    aforoMax: c.aforo_max,
    entrenadorId: c.entrenador_id,
    recurrente: c.recurrente,
  }));
}

export async function obtenerSesiones(): Promise<Sesion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sesiones")
    .select("id, clase_id, fecha, aforo_efectivo, abierta, created_at");
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    claseId: s.clase_id,
    fecha: s.fecha,
    aforoEfectivo: s.aforo_efectivo,
    abierta: s.abierta,
    createdAt: s.created_at,
  }));
}

export async function obtenerReservas(): Promise<Reserva[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservas")
    .select("id, sesion_id, cliente_id, estado, asistencia, cancelada_en, created_at, bono_id");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    sesionId: r.sesion_id,
    clienteId: r.cliente_id,
    estado: r.estado,
    asistencia: r.asistencia,
    canceladaEn: r.cancelada_en,
    createdAt: r.created_at,
    bonoId: r.bono_id,
  }));
}

// Solo las reservas de una clienta que le descontaron un credito de bono
// (bono_id no nulo): es lo que alimenta la lista de "sesiones de bono
// consumidas" de su ficha, acotada por cliente_id en vez de traer toda la
// tabla como obtenerReservas().
export async function obtenerReservasConBonoDeCliente(clienteId: string): Promise<Reserva[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservas")
    .select("id, sesion_id, cliente_id, estado, asistencia, cancelada_en, created_at, bono_id")
    .eq("cliente_id", clienteId)
    .not("bono_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    sesionId: r.sesion_id,
    clienteId: r.cliente_id,
    estado: r.estado,
    asistencia: r.asistencia,
    canceladaEn: r.cancelada_en,
    createdAt: r.created_at,
    bonoId: r.bono_id,
  }));
}

export async function obtenerPagos(): Promise<Pago[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagos")
    .select("id, cliente_id, plan_id, tipo, metodo, estado, importe, fecha_pago, ultimo_cobro, proximo_cobro, registrado_por");
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    clienteId: p.cliente_id,
    planId: p.plan_id,
    tipo: p.tipo,
    metodo: p.metodo,
    estado: p.estado,
    importe: p.importe,
    fechaPago: p.fecha_pago,
    ultimoCobro: p.ultimo_cobro,
    proximoCobro: p.proximo_cobro,
    registradoPor: p.registrado_por,
  }));
}

export async function obtenerBonosCliente(): Promise<BonoCliente[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bonos_cliente")
    .select("id, cliente_id, plan_id, tipo, creditos_totales, creditos_usados, fecha_compra, fecha_caducidad, activo");
  if (error) throw error;
  return (data ?? []).map((b) => ({
    id: b.id,
    clienteId: b.cliente_id,
    planId: b.plan_id,
    tipo: b.tipo,
    creditosTotales: b.creditos_totales,
    creditosUsados: b.creditos_usados,
    fechaCompra: b.fecha_compra,
    fechaCaducidad: b.fecha_caducidad,
    activo: b.activo,
  }));
}

export async function obtenerOcupacionSesiones(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ocupacion_sesiones");
  if (error) throw error;
  const mapa: Record<string, number> = {};
  for (const fila of data ?? []) {
    mapa[fila.sesion_id] = fila.confirmadas;
  }
  return mapa;
}

export async function obtenerHistorialDeCliente(clienteId: string): Promise<MovimientoHistorial[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservas_historial")
    .select("id, reserva_id, sesion_id, cliente_id, evento, creado_en")
    .eq("cliente_id", clienteId)
    .order("creado_en", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    reservaId: m.reserva_id,
    sesionId: m.sesion_id,
    clienteId: m.cliente_id,
    evento: m.evento,
    creadoEn: m.creado_en,
  }));
}

export async function obtenerFranjas(): Promise<FranjaHoraria[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("franjas_horarias")
    .select("id, hora_inicio, hora_fin, orden")
    .order("orden", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((f) => ({
    id: f.id,
    horaInicio: f.hora_inicio.slice(0, 5),
    horaFin: f.hora_fin.slice(0, 5),
    orden: f.orden,
  }));
}
