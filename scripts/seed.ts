import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { DEMO_PASSWORD } from "../lib/demo-accounts";
import { hoyEnEspana, sumarDias, sumarMesesMismoDia, inicioDeSemana } from "../lib/fechas";

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

// Horario fijo real del centro (Denia), facilitado por Elena antes de la demo:
// 12 franjas de 50 minutos, cada una activa solo los dias laborables que se
// listan aqui (nunca sabado ni domingo). Los huecos de mediodia
// (11:10-12:00, 12:00-12:50, 13:00-13:50) se dejan deliberadamente fuera de
// esta lista: son franjas que Elena puede abrir bajo demanda mas adelante, no
// clases fijas todavia -- no seedearlas.
interface FranjaHoraria {
  horaInicio: string;
  horaFin: string;
  dias: string[];
}

const FRANJAS: FranjaHoraria[] = [
  { horaInicio: "07:00", horaFin: "07:50", dias: ["lunes", "martes", "miercoles", "jueves", "viernes"] },
  { horaInicio: "07:50", horaFin: "08:40", dias: ["lunes", "martes", "miercoles", "jueves", "viernes"] },
  { horaInicio: "08:40", horaFin: "09:30", dias: ["lunes", "martes", "miercoles", "jueves", "viernes"] },
  { horaInicio: "09:30", horaFin: "10:20", dias: ["lunes", "martes", "miercoles", "jueves"] },
  { horaInicio: "13:50", horaFin: "14:40", dias: ["lunes", "miercoles", "viernes"] },
  { horaInicio: "14:40", horaFin: "15:30", dias: ["lunes", "miercoles", "viernes"] },
  { horaInicio: "16:00", horaFin: "16:50", dias: ["lunes", "martes", "miercoles", "jueves"] },
  { horaInicio: "16:50", horaFin: "17:40", dias: ["lunes", "martes", "miercoles", "jueves"] },
  { horaInicio: "17:40", horaFin: "18:30", dias: ["lunes", "martes", "miercoles", "jueves", "viernes"] },
  { horaInicio: "18:30", horaFin: "19:20", dias: ["lunes", "martes", "miercoles", "jueves", "viernes"] },
  { horaInicio: "19:20", horaFin: "20:10", dias: ["lunes", "martes", "miercoles", "jueves"] },
  { horaInicio: "20:10", horaFin: "21:00", dias: ["lunes", "martes", "miercoles", "jueves"] },
];

// Rejilla completa del centro: las 15 franjas horarias que existen como
// concepto, con independencia de si hoy tienen una clase fija encima. FRANJAS
// (arriba) genera las 51 clases del horario fijo; esta lista siembra la tabla
// franjas_horarias, que es lo que Elena ve cuando busca un hueco para abrir.
// Son listas deliberadamente distintas: las tres franjas de mediodia
// (11:10-12:00, 12:00-12:50, 13:00-13:50) no aparecen en FRANJAS porque no
// tienen ninguna clase, pero si pertenecen a la rejilla -- son justo las que
// Elena podria abrir bajo demanda.
const REJILLA_FRANJAS: { horaInicio: string; horaFin: string }[] = [
  { horaInicio: "07:00", horaFin: "07:50" },
  { horaInicio: "07:50", horaFin: "08:40" },
  { horaInicio: "08:40", horaFin: "09:30" },
  { horaInicio: "09:30", horaFin: "10:20" },
  { horaInicio: "11:10", horaFin: "12:00" },
  { horaInicio: "12:00", horaFin: "12:50" },
  { horaInicio: "13:00", horaFin: "13:50" },
  { horaInicio: "13:50", horaFin: "14:40" },
  { horaInicio: "14:40", horaFin: "15:30" },
  { horaInicio: "16:00", horaFin: "16:50" },
  { horaInicio: "16:50", horaFin: "17:40" },
  { horaInicio: "17:40", horaFin: "18:30" },
  { horaInicio: "18:30", horaFin: "19:20" },
  { horaInicio: "19:20", horaFin: "20:10" },
  { horaInicio: "20:10", horaFin: "21:00" },
];

const NUMERO_A_DIA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

function diaDeFecha(fecha: string): string {
  return NUMERO_A_DIA[new Date(`${fecha}T12:00:00Z`).getUTCDay()];
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

  const franjasAInsertar = REJILLA_FRANJAS.map((franja, indice) => ({
    hora_inicio: franja.horaInicio,
    hora_fin: franja.horaFin,
    orden: indice + 1,
  }));
  const { error: errorFranjas } = await admin.from("franjas_horarias").insert(franjasAInsertar);
  if (errorFranjas) throw errorFranjas;
  console.log(`Franjas horarias creadas: ${franjasAInsertar.length}`);

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

  const ivanId = idsPorEmail.get("ivan@elefitness.com")!;
  const elenaId = idsPorEmail.get("elena@elefitness.com")!;

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

  // Genera las 51 clases del horario fijo a partir de FRANJAS x dias.
  //
  // PROVISIONAL: el reparto de quien da cada clase lo confirmara Elena mas
  // adelante -- de momento no hay dato real. Se asigna Ivan a las clases que
  // empiezan antes de las 16:00 y Elena a las de 16:00 en adelante solo para
  // que la demo no muestre las 51 clases con el mismo entrenador. No tratar
  // este criterio como una regla de negocio real.
  const clasesAInsertar = FRANJAS.flatMap((franja) => {
    const entrenadorId = franja.horaInicio < "16:00" ? ivanId : elenaId;
    return franja.dias.map((dia) => ({
      dia: dia as "lunes" | "martes" | "miercoles" | "jueves" | "viernes",
      hora_inicio: franja.horaInicio,
      hora_fin: franja.horaFin,
      aforo_max: 5,
      entrenador_id: entrenadorId,
      recurrente: true,
    }));
  });

  if (clasesAInsertar.length !== 51) {
    throw new Error(`Se esperaban 51 clases en el horario fijo, se generaron ${clasesAInsertar.length}`);
  }

  const { data: clasesCreadas, error: errorClases } = await admin
    .from("clases")
    .insert(clasesAInsertar)
    .select("id, dia, hora_inicio, entrenador_id");
  if (errorClases || !clasesCreadas) throw errorClases ?? new Error("No se pudieron crear las clases del horario fijo");

  const totalIvan = clasesCreadas.filter((c) => c.entrenador_id === ivanId).length;
  const totalElena = clasesCreadas.filter((c) => c.entrenador_id === elenaId).length;
  console.log(`Clases creadas: ${clasesCreadas.length} (Ivan: ${totalIvan}, Elena: ${totalElena})`);

  // dia|horaInicio (HH:MM) -> id de clase, para localizar clases concretas al
  // generar sesiones y las reservas de ejemplo mas abajo.
  const claseIdPorClave = new Map<string, string>();
  for (const c of clasesCreadas) {
    claseIdPorClave.set(`${c.dia}|${c.hora_inicio.slice(0, 5)}`, c.id);
  }

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

  // Sesiones: semana actual + 3 semanas siguientes (4 semanas, lunes a
  // domingo), para que la ventana de reserva de 3 semanas del cliente y las
  // vistas de semana/mes del calendario tengan contenido real de cara a la
  // demo. tests/integration/rpc-copiar-semana.test.ts trabaja a 56 dias vista
  // precisamente para no pisar estas fechas: no alargar este rango sin
  // revisar ese test.
  const inicioSemanaActual = inicioDeSemana(hoyEnEspana());
  const NUM_DIAS_RANGO = 28;

  const sesionesAInsertar: { clase_id: string; fecha: string }[] = [];
  for (let i = 0; i < NUM_DIAS_RANGO; i++) {
    const fecha = sumarDias(inicioSemanaActual, i);
    const dia = diaDeFecha(fecha);
    for (const franja of FRANJAS) {
      if (!franja.dias.includes(dia)) continue;
      const claseId = claseIdPorClave.get(`${dia}|${franja.horaInicio}`)!;
      sesionesAInsertar.push({ clase_id: claseId, fecha });
    }
  }

  const { data: sesionesCreadas, error: errorSesiones } = await admin
    .from("sesiones")
    .insert(sesionesAInsertar)
    .select("id, clase_id, fecha");
  if (errorSesiones || !sesionesCreadas) throw errorSesiones ?? new Error("No se pudieron crear las sesiones");
  console.log(`Sesiones creadas: ${sesionesCreadas.length} (4 semanas desde ${inicioSemanaActual})`);

  const claseInfoPorId = new Map(clasesCreadas.map((c) => [c.id, { dia: c.dia, horaInicio: c.hora_inicio.slice(0, 5) }]));

  interface SesionEnriquecida {
    id: string;
    fecha: string;
    dia: string;
    horaInicio: string;
  }

  const sesionesEnriquecidas: SesionEnriquecida[] = sesionesCreadas
    .map((s) => {
      const info = claseInfoPorId.get(s.clase_id)!;
      return { id: s.id, fecha: s.fecha, dia: info.dia, horaInicio: info.horaInicio };
    })
    .sort((a, b) => (a.fecha === b.fecha ? a.horaInicio.localeCompare(b.horaInicio) : a.fecha.localeCompare(b.fecha)));

  // Fixture deterministico para tests/integration/rpc-authz.test.ts: la
  // primera sesion (fecha mas temprana) de la clase de lunes 7:00, con una
  // reserva confirmada de Maria. El test localiza esta clase filtrando por
  // dia + hora_inicio (no por .single() sobre "dia" a secas, que con 12
  // clases de lunes lanzaria).
  const sesionFixtureLunes = sesionesEnriquecidas.find((s) => s.dia === "lunes" && s.horaInicio === "07:00");
  if (!sesionFixtureLunes) throw new Error("No se genero la sesion de lunes 07:00 usada como fixture de tests");

  // Fixture de variedad: una clase llena (aforo 5) con Laura en lista de
  // espera, igual que en el seed anterior -- lista_espera no consume credito
  // de bono, asi que el bono de Laura sembrado arriba queda intacto.
  const sesionFixtureMiercoles = sesionesEnriquecidas.find((s) => s.dia === "miercoles" && s.horaInicio === "19:20");
  if (!sesionFixtureMiercoles) throw new Error("No se genero la sesion de miercoles 19:20 usada como fixture de demo");

  const reservasAInsertar: { sesion_id: string; cliente_id: string; estado: "confirmada" | "lista_espera" }[] = [
    { sesion_id: sesionFixtureLunes.id, cliente_id: idMaria, estado: "confirmada" },
    { sesion_id: sesionFixtureMiercoles.id, cliente_id: idAna, estado: "confirmada" },
    { sesion_id: sesionFixtureMiercoles.id, cliente_id: idBeatriz, estado: "confirmada" },
    { sesion_id: sesionFixtureMiercoles.id, cliente_id: idCarla, estado: "confirmada" },
    { sesion_id: sesionFixtureMiercoles.id, cliente_id: idDiana, estado: "confirmada" },
    { sesion_id: sesionFixtureMiercoles.id, cliente_id: idEva, estado: "confirmada" },
    { sesion_id: sesionFixtureMiercoles.id, cliente_id: idLaura, estado: "lista_espera" },
  ];

  // Reparto del resto de sesiones para que las vistas de dia/semana/mes del
  // calendario muestren ocupacion variada (llena, a medias, vacia) en vez de
  // una sola sesion con contenido. Solo se usan clientas de plan mensual
  // (Laura, de bono, ya queda cubierta arriba): asi ninguna reserva adicional
  // consume creditos de bonos_cliente y "planes, pagos y bonos" de las 8
  // clientas del seed quedan exactamente como estaban. Los niveles se
  // asignan por indice de forma deterministica -- no es una simulacion real
  // de demanda, solo variedad visual para la demo.
  const clientesMensuales = [idMaria, idSara, idAna, idBeatriz, idCarla, idDiana, idEva];
  const NIVELES_OCUPACION = [2, 5, 3, 4, 1, 5, 2, 3];
  const sesionesFixture = new Set([sesionFixtureLunes.id, sesionFixtureMiercoles.id]);

  let indice = 0;
  for (const sesion of sesionesEnriquecidas) {
    if (sesionesFixture.has(sesion.id)) continue;
    if (indice % 2 === 0) {
      const nivel = NIVELES_OCUPACION[(indice / 2) % NIVELES_OCUPACION.length];
      for (let j = 0; j < nivel; j++) {
        const clienteId = clientesMensuales[(indice + j) % clientesMensuales.length];
        reservasAInsertar.push({ sesion_id: sesion.id, cliente_id: clienteId, estado: "confirmada" });
      }
    }
    indice++;
  }

  const { error: errorReservas } = await admin.from("reservas").insert(reservasAInsertar);
  if (errorReservas) throw errorReservas;
  console.log(`Reservas creadas: ${reservasAInsertar.length}`);

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
