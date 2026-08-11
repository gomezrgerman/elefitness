import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { DEMO_PASSWORD } from "../lib/demo-accounts";
import { hoyEnEspana, sumarDias, sumarMesesMismoDia } from "../lib/fechas";

const admin = createAdminClient();

interface SeedUsuario {
  email: string;
  nombre: string;
  telefono: string;
  rol: "admin" | "entrenador" | "cliente";
}

const usuarios: SeedUsuario[] = [
  { email: "elena@elefitness.com", nombre: "Elena", telefono: "600111222", rol: "admin" },
  { email: "ivan@elefitness.com", nombre: "Ivan", telefono: "600333444", rol: "entrenador" },
  { email: "maria@example.com", nombre: "Maria Lopez", telefono: "600555001", rol: "cliente" },
  { email: "laura@example.com", nombre: "Laura Fernandez", telefono: "600555002", rol: "cliente" },
  { email: "sara@example.com", nombre: "Sara Gimenez", telefono: "600555003", rol: "cliente" },
  { email: "ana@example.com", nombre: "Ana Ruiz", telefono: "600555004", rol: "cliente" },
  { email: "beatriz@example.com", nombre: "Beatriz Soto", telefono: "600555005", rol: "cliente" },
  { email: "carla@example.com", nombre: "Carla Vidal", telefono: "600555006", rol: "cliente" },
  { email: "diana@example.com", nombre: "Diana Ortiz", telefono: "600555007", rol: "cliente" },
  { email: "eva@example.com", nombre: "Eva Molina", telefono: "600555008", rol: "cliente" },
];

const DIA_A_NUMERO: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

// Primera ocurrencia de `dia` a partir de hoy + minDias. "Hoy" se resuelve en
// Europe/Madrid (hoyEnEspana), no en UTC: anclarlo en `new Date()` + UTC hacia
// desplazaba la fixture un dia si el seed se corria justo despues de
// medianoche en Espana, cuando UTC todavia (o ya) va por otro dia civil segun
// la epoca del anyo -- se ve como un bug en plena demo con la clienta.
//
// minDias existe porque los tests de integracion comprueban la regla de las 24h
// contra las sesiones del seed: con la version anterior (proxima ocurrencia del
// dia, aunque fuera manana) el seed podia generar una sesion a menos de 24h y
// romper esos tests segun el dia de la semana en que se ejecutara. 7 dias deja
// la sesion holgadamente por encima del corte de 24h y por debajo de la ventana
// de reserva de 21 dias.
function proximaFecha(dia: string, minDias: number): string {
  const objetivo = DIA_A_NUMERO[dia];
  let fecha = sumarDias(hoyEnEspana(), minDias);
  while (new Date(`${fecha}T12:00:00Z`).getUTCDay() !== objetivo) {
    fecha = sumarDias(fecha, 1);
  }
  return fecha;
}

function fechaRelativaHoy(dias: number): string {
  return sumarDias(hoyEnEspana(), dias);
}

async function main() {
  const { data: centroExistente } = await admin.from("centro").select("id").limit(1);
  if (centroExistente && centroExistente.length > 0) {
    throw new Error("El proyecto ya tiene datos (tabla centro no esta vacia). Aborta para no duplicar seeds.");
  }

  const { error: errorCentro } = await admin.from("centro").insert({ nombre: "Elefitness", color_marca: "#16A34A" });
  if (errorCentro) throw errorCentro;

  const idsPorEmail = new Map<string, string>();
  for (const u of usuarios) {
    const { data: authUser, error: errorAuth } = await admin.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (errorAuth || !authUser.user) throw errorAuth ?? new Error(`No se pudo crear auth user ${u.email}`);

    const { error: errorUsers } = await admin.from("users").insert({
      id: authUser.user.id,
      email: u.email,
      rol: u.rol,
      nombre: u.nombre,
      telefono: u.telefono,
    });
    if (errorUsers) throw errorUsers;

    idsPorEmail.set(u.email, authUser.user.id);
  }

  const { data: planMensual, error: errorPlanMensual } = await admin
    .from("planes")
    .insert({ nombre: "Cuota mensual", precio: 45, tipo: "mensual", clases_incluidas: null })
    .select()
    .single();
  if (errorPlanMensual || !planMensual) throw errorPlanMensual ?? new Error("No se pudo crear plan mensual");

  const { data: planBono, error: errorPlanBono } = await admin
    .from("planes")
    .insert({ nombre: "Bono 10 clases", precio: 80, tipo: "bono", clases_incluidas: 10 })
    .select()
    .single();
  if (errorPlanBono || !planBono) throw errorPlanBono ?? new Error("No se pudo crear plan bono");

  const ivanId = idsPorEmail.get("ivan@elefitness.com")!;
  const { data: claseLunes, error: errorClaseLunes } = await admin
    .from("clases")
    .insert({ dia: "lunes", hora_inicio: "18:00", hora_fin: "19:00", aforo_max: 5, entrenador_id: ivanId, recurrente: true })
    .select()
    .single();
  if (errorClaseLunes || !claseLunes) throw errorClaseLunes ?? new Error("No se pudo crear clase-lunes");

  const { data: claseMiercoles, error: errorClaseMiercoles } = await admin
    .from("clases")
    .insert({ dia: "miercoles", hora_inicio: "19:00", hora_fin: "20:00", aforo_max: 5, entrenador_id: ivanId, recurrente: true })
    .select()
    .single();
  if (errorClaseMiercoles || !claseMiercoles) throw errorClaseMiercoles ?? new Error("No se pudo crear clase-miercoles");

  const clientesSeed = [
    { email: "maria@example.com", planId: planMensual.id, notas: "Full body 3x/semana, foco en tren inferior. Progresar sentadilla goblet.", diasSemana: 3 },
    { email: "laura@example.com", planId: planBono.id, notas: "Circuito funcional, cuidado con el hombro derecho.", diasSemana: 3 },
    { email: "sara@example.com", planId: planMensual.id, notas: "Readaptacion tras baja, sin saltos todavia.", diasSemana: 1 },
    { email: "ana@example.com", planId: planMensual.id, notas: "", diasSemana: 2 },
    { email: "beatriz@example.com", planId: planMensual.id, notas: "", diasSemana: 2 },
    { email: "carla@example.com", planId: planMensual.id, notas: "", diasSemana: 2 },
    { email: "diana@example.com", planId: planMensual.id, notas: "", diasSemana: 2 },
    { email: "eva@example.com", planId: planMensual.id, notas: "", diasSemana: 2 },
  ];

  const idsClientePorEmail = new Map<string, string>();
  for (const c of clientesSeed) {
    const usuarioId = idsPorEmail.get(c.email)!;
    const { data: cliente, error: errorCliente } = await admin
      .from("clientes")
      .insert({ usuario_id: usuarioId, plan_id: c.planId, notas_rutina: c.notas, dias_semana_habituales: c.diasSemana })
      .select()
      .single();
    if (errorCliente || !cliente) throw errorCliente ?? new Error(`No se pudo crear cliente ${c.email}`);
    idsClientePorEmail.set(c.email, cliente.id);
  }

  const idMaria = idsClientePorEmail.get("maria@example.com")!;
  const idLaura = idsClientePorEmail.get("laura@example.com")!;
  const idSara = idsClientePorEmail.get("sara@example.com")!;
  const idAna = idsClientePorEmail.get("ana@example.com")!;
  const idBeatriz = idsClientePorEmail.get("beatriz@example.com")!;
  const idCarla = idsClientePorEmail.get("carla@example.com")!;
  const idDiana = idsClientePorEmail.get("diana@example.com")!;
  const idEva = idsClientePorEmail.get("eva@example.com")!;

  const { data: sesionLunes, error: errorSesionLunes } = await admin
    .from("sesiones")
    .insert({ clase_id: claseLunes.id, fecha: proximaFecha("lunes", 7) })
    .select()
    .single();
  if (errorSesionLunes || !sesionLunes) throw errorSesionLunes ?? new Error("No se pudo crear sesion-lunes");

  const { data: sesionMiercoles, error: errorSesionMiercoles } = await admin
    .from("sesiones")
    .insert({ clase_id: claseMiercoles.id, fecha: proximaFecha("miercoles", 7) })
    .select()
    .single();
  if (errorSesionMiercoles || !sesionMiercoles) throw errorSesionMiercoles ?? new Error("No se pudo crear sesion-miercoles");

  const { error: errorReservas } = await admin.from("reservas").insert([
    { sesion_id: sesionLunes.id, cliente_id: idMaria, estado: "confirmada" },
    { sesion_id: sesionMiercoles.id, cliente_id: idAna, estado: "confirmada" },
    { sesion_id: sesionMiercoles.id, cliente_id: idBeatriz, estado: "confirmada" },
    { sesion_id: sesionMiercoles.id, cliente_id: idCarla, estado: "confirmada" },
    { sesion_id: sesionMiercoles.id, cliente_id: idDiana, estado: "confirmada" },
    { sesion_id: sesionMiercoles.id, cliente_id: idEva, estado: "confirmada" },
    { sesion_id: sesionMiercoles.id, cliente_id: idLaura, estado: "lista_espera" },
  ]);
  if (errorReservas) throw errorReservas;

  const elenaId = idsPorEmail.get("elena@elefitness.com")!;
  const { error: errorPagos } = await admin.from("pagos").insert([
    { cliente_id: idMaria, plan_id: planMensual.id, tipo: "mensual", metodo: "stripe", estado: "al_dia", importe: 45, fecha_pago: "2026-07-01", ultimo_cobro: "2026-07-01", proximo_cobro: "2026-08-01", registrado_por: elenaId },
    { cliente_id: idLaura, plan_id: planBono.id, tipo: "bono", metodo: "efectivo", estado: "al_dia", importe: 80, fecha_pago: "2026-04-02", ultimo_cobro: "2026-04-02", proximo_cobro: null, registrado_por: elenaId },
    { cliente_id: idSara, plan_id: planMensual.id, tipo: "mensual", metodo: "stripe", estado: "moroso", importe: 45, fecha_pago: "2026-06-01", ultimo_cobro: "2026-06-01", proximo_cobro: "2026-07-01", registrado_por: elenaId },
    { cliente_id: idAna, plan_id: planMensual.id, tipo: "mensual", metodo: "stripe", estado: "al_dia", importe: 45, fecha_pago: "2026-07-01", ultimo_cobro: "2026-07-01", proximo_cobro: "2026-08-01", registrado_por: elenaId },
    { cliente_id: idBeatriz, plan_id: planMensual.id, tipo: "mensual", metodo: "stripe", estado: "al_dia", importe: 45, fecha_pago: "2026-07-01", ultimo_cobro: "2026-07-01", proximo_cobro: "2026-08-01", registrado_por: elenaId },
    { cliente_id: idCarla, plan_id: planMensual.id, tipo: "mensual", metodo: "stripe", estado: "al_dia", importe: 45, fecha_pago: "2026-07-01", ultimo_cobro: "2026-07-01", proximo_cobro: "2026-08-01", registrado_por: elenaId },
    { cliente_id: idDiana, plan_id: planMensual.id, tipo: "mensual", metodo: "stripe", estado: "al_dia", importe: 45, fecha_pago: "2026-07-01", ultimo_cobro: "2026-07-01", proximo_cobro: "2026-08-01", registrado_por: elenaId },
    { cliente_id: idEva, plan_id: planMensual.id, tipo: "mensual", metodo: "stripe", estado: "al_dia", importe: 45, fecha_pago: "2026-07-01", ultimo_cobro: "2026-07-01", proximo_cobro: "2026-08-01", registrado_por: elenaId },
  ]);
  if (errorPagos) throw errorPagos;

  // Relativo a hoy, no una fecha fija: con la fecha de compra hardcodeada, el
  // bono de Laura caducaba en una fecha concreta del calendario y a partir de
  // ese dia el filtro de caducidad de reservar_sesion lo excluia, tumbando
  // varios tests de integracion sin que nadie hubiera tocado el codigo.
  const fechaCompraBono = fechaRelativaHoy(-14);
  const caducidadBono = sumarMesesMismoDia(fechaCompraBono, 3);
  const { error: errorBono } = await admin.from("bonos_cliente").insert({
    cliente_id: idLaura,
    plan_id: planBono.id,
    tipo: "normal",
    creditos_totales: 10,
    creditos_usados: 0,
    fecha_compra: fechaCompraBono,
    fecha_caducidad: caducidadBono,
    activo: true,
  });
  if (errorBono) throw errorBono;

  console.log("Seed completado.");
  console.log(`Password para las 10 cuentas: ${DEMO_PASSWORD}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
