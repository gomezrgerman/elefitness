import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { borrarClases, clienteIdPorEmail, crearClaseConSesion, signInAs } from "./helpers";

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// La semana de origen se coloca a 8 semanas vista a proposito: asi no contiene
// ninguna sesion del seed ni de otros ficheros de test, y copiar_semana (que
// desde la migracion 0010 copia los 7 dias del rango, no solo uno) solo toca
// las sesiones de este fichero.
const OFFSET_HORAS_ORIGEN = 56 * 24;

describe("copiar_semana RPC", () => {
  const admin = createAdminClient();
  const clasesCreadas: string[] = [];
  let claseLunesId: string;
  let sesionLunesId: string;
  let claseJuevesId: string;
  let fechaOrigen: string;
  let fechaSegundoDia: string;
  let fechaDestino: string;
  let mariaClienteId: string;

  beforeAll(async () => {
    mariaClienteId = await clienteIdPorEmail(admin, "maria@example.com");

    // Primer dia de la semana de origen, con aforo_efectivo reducido: una
    // reduccion de aforo debe sobrevivir a la copia.
    const primera = await crearClaseConSesion(admin, {
      offsetHoras: OFFSET_HORAS_ORIGEN,
      aforoMax: 5,
      aforoEfectivo: 2,
    });
    clasesCreadas.push(primera.claseId);
    claseLunesId = primera.claseId;
    sesionLunesId = primera.sesionId;
    fechaOrigen = primera.fecha;

    // Tercer dia de la misma semana: si copiar_semana volviera a copiar un solo
    // dia (el bug de 0008), esta sesion no apareceria en el destino.
    const segunda = await crearClaseConSesion(admin, { offsetHoras: OFFSET_HORAS_ORIGEN + 72, aforoMax: 5 });
    clasesCreadas.push(segunda.claseId);
    claseJuevesId = segunda.claseId;
    fechaSegundoDia = segunda.fecha;

    fechaDestino = sumarDias(fechaOrigen, 7);

    await admin.from("reservas").insert({ sesion_id: sesionLunesId, cliente_id: mariaClienteId, estado: "confirmada" });
  });

  afterAll(async () => {
    await borrarClases(admin, clasesCreadas);
  });

  it("rechaza un desplazamiento que no es multiplo de 7 dias", async () => {
    const elena = await signInAs("elena@elefitness.com");
    const { error } = await elena.rpc("copiar_semana", {
      p_fecha_origen: fechaOrigen,
      p_fecha_destino: sumarDias(fechaOrigen, 3),
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/multiplo de 7/);

    const { data: sesiones } = await admin
      .from("sesiones")
      .select("id")
      .eq("clase_id", claseLunesId)
      .eq("fecha", sumarDias(fechaOrigen, 3));
    expect(sesiones).toEqual([]);
  });

  it("rechaza una fecha destino anterior o igual a la de origen", async () => {
    const elena = await signInAs("elena@elefitness.com");
    const { error } = await elena.rpc("copiar_semana", {
      p_fecha_origen: fechaOrigen,
      p_fecha_destino: sumarDias(fechaOrigen, -7),
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/posterior/);
  });

  it("copia la semana entera (no solo un dia), con su aforo_efectivo y sus reservas confirmadas", async () => {
    const elena = await signInAs("elena@elefitness.com");
    const { data, error } = await elena.rpc("copiar_semana", {
      p_fecha_origen: fechaOrigen,
      p_fecha_destino: fechaDestino,
    });
    expect(error).toBeNull();
    // Solo la sesion del primer dia tiene una reserva confirmada que copiar.
    expect(data).toBe(1);

    const { data: copiaPrimerDia } = await admin
      .from("sesiones")
      .select("id, aforo_efectivo")
      .eq("clase_id", claseLunesId)
      .eq("fecha", fechaDestino)
      .single();
    expect(copiaPrimerDia).not.toBeNull();
    expect(copiaPrimerDia?.aforo_efectivo).toBe(2);

    const { data: copiaTercerDia } = await admin
      .from("sesiones")
      .select("id, aforo_efectivo")
      .eq("clase_id", claseJuevesId)
      .eq("fecha", sumarDias(fechaSegundoDia, 7))
      .single();
    expect(copiaTercerDia).not.toBeNull();
    expect(copiaTercerDia?.aforo_efectivo).toBeNull();

    const { data: reservaCopiada } = await admin
      .from("reservas")
      .select("estado")
      .eq("sesion_id", copiaPrimerDia!.id)
      .eq("cliente_id", mariaClienteId)
      .single();
    expect(reservaCopiada?.estado).toBe("confirmada");
  });

  it("un cliente no puede copiar el horario (admin-only)", async () => {
    const maria = await signInAs("maria@example.com");
    const { error } = await maria.rpc("copiar_semana", {
      p_fecha_origen: fechaOrigen,
      p_fecha_destino: sumarDias(fechaOrigen, 14),
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/No autorizado/);
  });
});
