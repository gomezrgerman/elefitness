import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/database.types";
import { DEMO_PASSWORD } from "../../lib/demo-accounts";

export function anonClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// Supabase limita los inicios de sesion por proyecto (unas decenas cada pocos
// minutos). Con un signInWithPassword por cada uso la suite se comia el cupo y
// fallaba con "Request rate limit reached", asi que se cachea un cliente por
// email. vitest corre con isolate:false (ver vitest.config.ts) para que la
// cache se comparta entre ficheros: 6 logins por ejecucion en vez de ~35.
const clientesPorEmail = new Map<string, SupabaseClient<Database>>();

export async function signInAs(email: string) {
  const cacheado = clientesPorEmail.get(email);
  if (cacheado) return cacheado;

  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw error;
  clientesPorEmail.set(email, client);
  return client;
}

type AdminClient = SupabaseClient<Database>;

const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"] as const;

// Las RPCs comparan (sesion.fecha + clase.hora_inicio) — un timestamp sin zona —
// contra now(). Postgres resuelve esa comparacion en la zona de la sesion, que
// en Supabase es UTC, asi que las fechas/horas de fixture se construyen en UTC
// para que "dentro de 12h" signifique de verdad 12h y los tests de la ventana de
// 24h no dependan de la hora local ni del horario de verano.
export function instanteUtc(offsetHoras: number): { fecha: string; hora: string; dia: (typeof DIAS)[number] } {
  const d = new Date(Date.now() + offsetHoras * 3600 * 1000);
  const iso = d.toISOString();
  return { fecha: iso.slice(0, 10), hora: iso.slice(11, 16), dia: DIAS[d.getUTCDay()] };
}

export interface FixtureSesion {
  claseId: string;
  sesionId: string;
  fecha: string;
  hora: string;
}

// Crea una clase dedicada al test con su primera sesion al offset pedido. Cada
// test que necesita una fecha concreta (pasada, dentro de 24h, a 5 dias) crea la
// suya en vez de depender de las fechas del seed: asi la regla que se comprueba
// no cambia segun el dia en que se ejecute la suite.
export async function crearClaseConSesion(
  admin: AdminClient,
  opciones: { offsetHoras: number; aforoMax?: number; aforoEfectivo?: number | null }
): Promise<FixtureSesion> {
  const { fecha, hora, dia } = instanteUtc(opciones.offsetHoras);

  const { data: entrenador, error: errorEntrenador } = await admin
    .from("users")
    .select("id")
    .eq("email", "ivan@elefitness.com")
    .single();
  if (errorEntrenador || !entrenador) throw errorEntrenador ?? new Error("No se encontro al entrenador del seed");

  const horaFin = `${String((Number(hora.slice(0, 2)) + 1) % 24).padStart(2, "0")}:${hora.slice(3, 5)}`;
  const { data: clase, error: errorClase } = await admin
    .from("clases")
    .insert({
      dia,
      hora_inicio: hora,
      hora_fin: horaFin,
      aforo_max: opciones.aforoMax ?? 5,
      entrenador_id: entrenador.id,
      recurrente: false,
    })
    .select()
    .single();
  if (errorClase || !clase) throw errorClase ?? new Error("No se pudo crear la clase de fixture");

  const { data: sesion, error: errorSesion } = await admin
    .from("sesiones")
    .insert({ clase_id: clase.id, fecha, aforo_efectivo: opciones.aforoEfectivo ?? null })
    .select()
    .single();
  if (errorSesion || !sesion) throw errorSesion ?? new Error("No se pudo crear la sesion de fixture");

  return { claseId: clase.id, sesionId: sesion.id, fecha, hora };
}

// Borrar la clase arrastra en cascada sesiones -> reservas -> reservas_historial.
export async function borrarClases(admin: AdminClient, claseIds: string[]): Promise<void> {
  for (const id of claseIds) {
    await admin.from("clases").delete().eq("id", id);
  }
}

export async function clienteIdPorEmail(admin: AdminClient, email: string): Promise<string> {
  const { data: usuario, error: errorUsuario } = await admin.from("users").select("id").eq("email", email).single();
  if (errorUsuario || !usuario) throw errorUsuario ?? new Error(`No se encontro el usuario ${email}`);
  const { data: cliente, error: errorCliente } = await admin
    .from("clientes")
    .select("id")
    .eq("usuario_id", usuario.id)
    .single();
  if (errorCliente || !cliente) throw errorCliente ?? new Error(`No se encontro la clienta ${email}`);
  return cliente.id;
}
