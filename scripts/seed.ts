import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { DEMO_PASSWORD } from "../lib/demo-accounts";

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
    { email: "maria@example.com", planId: planMensual.id, notas: "Full body 3x/semana, foco en tren inferior. Progresar sentadilla goblet." },
    { email: "laura@example.com", planId: planBono.id, notas: "Circuito funcional, cuidado con el hombro derecho." },
    { email: "sara@example.com", planId: planMensual.id, notas: "Readaptacion tras baja, sin saltos todavia." },
    { email: "ana@example.com", planId: planMensual.id, notas: "" },
    { email: "beatriz@example.com", planId: planMensual.id, notas: "" },
    { email: "carla@example.com", planId: planMensual.id, notas: "" },
    { email: "diana@example.com", planId: planMensual.id, notas: "" },
    { email: "eva@example.com", planId: planMensual.id, notas: "" },
  ];

  const idsClientePorEmail = new Map<string, string>();
  for (const c of clientesSeed) {
    const usuarioId = idsPorEmail.get(c.email)!;
    const { data: cliente, error: errorCliente } = await admin
      .from("clientes")
      .insert({ usuario_id: usuarioId, plan_id: c.planId, notas_rutina: c.notas })
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

  const { error: errorReservas } = await admin.from("reservas").insert([
    { clase_id: claseLunes.id, cliente_id: idMaria, estado: "confirmada" },
    { clase_id: claseMiercoles.id, cliente_id: idAna, estado: "confirmada" },
    { clase_id: claseMiercoles.id, cliente_id: idBeatriz, estado: "confirmada" },
    { clase_id: claseMiercoles.id, cliente_id: idCarla, estado: "confirmada" },
    { clase_id: claseMiercoles.id, cliente_id: idDiana, estado: "confirmada" },
    { clase_id: claseMiercoles.id, cliente_id: idEva, estado: "confirmada" },
    { clase_id: claseMiercoles.id, cliente_id: idLaura, estado: "lista_espera" },
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

  const { error: errorBono } = await admin.from("bonos_cliente").insert({
    cliente_id: idLaura,
    plan_id: planBono.id,
    creditos_totales: 10,
    creditos_usados: 0,
    fecha_compra: "2026-04-02",
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
