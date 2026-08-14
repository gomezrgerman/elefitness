import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { borrarClases, clienteIdPorEmail, crearClaseConSesion, signInAs } from "./helpers";

// Migracion 0018: eliminar_sesion borra una sesion suelta (festivos, ajustes
// puntuales tras copiar la semana) sin tocar el resto del horario fijo.
// Bloqueada si hay reservas activas, para que Elena cancele antes desde la
// vista de dia (asi cancelar_reserva devuelve el credito o emite el bono de
// recuperacion que le corresponda a cada clienta, en vez de perderse en cascada).
describe("eliminar_sesion RPC", () => {
  const admin = createAdminClient();
  const clasesCreadas: string[] = [];
  let mariaClienteId: string;

  beforeAll(async () => {
    mariaClienteId = await clienteIdPorEmail(admin, "maria@example.com");
  });

  afterAll(async () => {
    await borrarClases(admin, clasesCreadas);
  });

  it("un cliente no puede eliminar sesiones (admin-only)", async () => {
    const fixture = await crearClaseConSesion(admin, { offsetHoras: 40 });
    clasesCreadas.push(fixture.claseId);

    const maria = await signInAs("maria@example.com");
    const { error } = await maria.rpc("eliminar_sesion", { p_sesion_id: fixture.sesionId });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/No autorizado/);

    const { data: sigueViva } = await admin.from("sesiones").select("id").eq("id", fixture.sesionId).maybeSingle();
    expect(sigueViva).not.toBeNull();
  });

  it("un entrenador no puede eliminar sesiones (admin-only)", async () => {
    const fixture = await crearClaseConSesion(admin, { offsetHoras: 41 });
    clasesCreadas.push(fixture.claseId);

    const ivan = await signInAs("ivan@elefitness.com");
    const { error } = await ivan.rpc("eliminar_sesion", { p_sesion_id: fixture.sesionId });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/No autorizado/);
  });

  it("no se puede eliminar una sesion con reservas activas", async () => {
    const fixture = await crearClaseConSesion(admin, { offsetHoras: 42 });
    clasesCreadas.push(fixture.claseId);

    const maria = await signInAs("maria@example.com");
    const { error: errorReserva } = await maria.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: mariaClienteId,
    });
    expect(errorReserva).toBeNull();

    const elena = await signInAs("elena@elefitness.com");
    const { error } = await elena.rpc("eliminar_sesion", { p_sesion_id: fixture.sesionId });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/reservas activas/);

    const { data: sigueViva } = await admin.from("sesiones").select("id").eq("id", fixture.sesionId).maybeSingle();
    expect(sigueViva).not.toBeNull();
  });

  it("el admin puede eliminar una sesion sin reservas activas (una reserva cancelada no cuenta)", async () => {
    const fixture = await crearClaseConSesion(admin, { offsetHoras: 43 });
    clasesCreadas.push(fixture.claseId);

    const maria = await signInAs("maria@example.com");
    const { data: reserva, error: errorReserva } = await maria.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: mariaClienteId,
    });
    expect(errorReserva).toBeNull();
    const { error: errorCancelar } = await maria.rpc("cancelar_reserva", { p_reserva_id: reserva!.id });
    expect(errorCancelar).toBeNull();

    const elena = await signInAs("elena@elefitness.com");
    const { error } = await elena.rpc("eliminar_sesion", { p_sesion_id: fixture.sesionId });
    expect(error).toBeNull();

    const { data: borrada } = await admin.from("sesiones").select("id").eq("id", fixture.sesionId).maybeSingle();
    expect(borrada).toBeNull();
  });

  it("eliminar la sesion de un hueco puntual tambien borra la clase huerfana; el horario fijo no se toca", async () => {
    const fixtureFijo = await crearClaseConSesion(admin, { offsetHoras: 44, recurrente: true });
    clasesCreadas.push(fixtureFijo.claseId);
    const fixtureHueco = await crearClaseConSesion(admin, { offsetHoras: 45, recurrente: false });
    // No se anade fixtureHueco.claseId a clasesCreadas: este test comprueba que
    // eliminar_sesion ya la borra ella sola.

    const elena = await signInAs("elena@elefitness.com");
    const { error } = await elena.rpc("eliminar_sesion", { p_sesion_id: fixtureHueco.sesionId });
    expect(error).toBeNull();

    const { data: claseHuecoRestante } = await admin.from("clases").select("id").eq("id", fixtureHueco.claseId).maybeSingle();
    expect(claseHuecoRestante).toBeNull();

    const { data: claseFijaRestante } = await admin.from("clases").select("id").eq("id", fixtureFijo.claseId).maybeSingle();
    expect(claseFijaRestante).not.toBeNull();
  });
});
