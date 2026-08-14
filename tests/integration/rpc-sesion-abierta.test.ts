import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { borrarClases, clienteIdPorEmail, crearClaseConSesion, signInAs } from "./helpers";

// Migracion 0015: sesiones.abierta distingue un hueco donde solo Elena mete
// gente a mano (o una clase fija que ha cerrado) de una sesion reservable por
// la clienta. Cada test crea su propia clase/sesion via crearClaseConSesion
// (offset dentro de la ventana de reserva de 3 semanas) para no depender del
// dia en que corra la suite, y se limpia con borrarClases en afterAll.
describe("Sesiones cerradas (sesiones.abierta)", () => {
  const admin = createAdminClient();
  const clasesCreadas: string[] = [];
  let mariaClienteId: string;
  let anaClienteId: string;

  beforeAll(async () => {
    mariaClienteId = await clienteIdPorEmail(admin, "maria@example.com");
    anaClienteId = await clienteIdPorEmail(admin, "ana@example.com");
  });

  afterAll(async () => {
    await borrarClases(admin, clasesCreadas);
  });

  it("una clienta no puede reservar en una sesion cerrada, y no queda ninguna reserva", async () => {
    const fixture = await crearClaseConSesion(admin, { offsetHoras: 40 });
    clasesCreadas.push(fixture.claseId);
    await admin.from("sesiones").update({ abierta: false }).eq("id", fixture.sesionId);

    const maria = await signInAs("maria@example.com");
    const { error } = await maria.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: mariaClienteId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/no esta abierta para reservas/);

    const { data: reservas } = await admin.from("reservas").select("id").eq("sesion_id", fixture.sesionId);
    expect(reservas).toEqual([]);
  });

  it("el admin si puede reservar en una sesion cerrada en nombre de una clienta", async () => {
    const fixture = await crearClaseConSesion(admin, { offsetHoras: 44 });
    clasesCreadas.push(fixture.claseId);
    await admin.from("sesiones").update({ abierta: false }).eq("id", fixture.sesionId);

    const elena = await signInAs("elena@elefitness.com");
    const { data, error } = await elena.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: mariaClienteId,
    });
    expect(error).toBeNull();
    expect(data?.estado).toBe("confirmada");
  });

  it("cerrar una sesion no afecta a una reserva ya existente: la clienta la mantiene y puede cancelarla", async () => {
    const fixture = await crearClaseConSesion(admin, { offsetHoras: 48 });
    clasesCreadas.push(fixture.claseId);

    const ana = await signInAs("ana@example.com");
    const { data: reserva, error: errorReserva } = await ana.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: anaClienteId,
    });
    expect(errorReserva).toBeNull();
    expect(reserva?.estado).toBe("confirmada");

    await admin.from("sesiones").update({ abierta: false }).eq("id", fixture.sesionId);

    const { data: sigueViva } = await admin.from("reservas").select("estado").eq("id", reserva!.id).single();
    expect(sigueViva?.estado).toBe("confirmada");

    const { error: errorCancelar } = await ana.rpc("cancelar_reserva", { p_reserva_id: reserva!.id });
    expect(errorCancelar).toBeNull();

    const { data: cancelada } = await admin.from("reservas").select("estado").eq("id", reserva!.id).single();
    expect(cancelada?.estado).toBe("cancelada");
  });

  it("reabrir una sesion cerrada la vuelve reservable por la clienta", async () => {
    const fixture = await crearClaseConSesion(admin, { offsetHoras: 52 });
    clasesCreadas.push(fixture.claseId);
    await admin.from("sesiones").update({ abierta: false }).eq("id", fixture.sesionId);

    const maria = await signInAs("maria@example.com");
    const { error: errorCerrada } = await maria.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: mariaClienteId,
    });
    expect(errorCerrada).not.toBeNull();

    await admin.from("sesiones").update({ abierta: true }).eq("id", fixture.sesionId);

    const { data, error } = await maria.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: mariaClienteId,
    });
    expect(error).toBeNull();
    expect(data?.estado).toBe("confirmada");
  });
});

// Migracion 0015: clientes.entrenador_restringido_id (nullable) limita a una
// clienta a reservar solo las clases de un entrenador concreto. `null` (el
// valor por defecto de todo el seed) no debe restringir nada -- uno de los
// tests de abajo lo fija a proposito para que una guarda que restringiera a
// todo el mundo por error no pasara desapercibida.
describe("Restriccion de entrenador por clienta (clientes.entrenador_restringido_id)", () => {
  const admin = createAdminClient();
  const clasesCreadas: string[] = [];
  let mariaClienteId: string;
  let saraClienteId: string;
  let ivanId: string;
  let elenaId: string;
  let sesionIvanId: string;
  let sesionElenaId: string;

  beforeAll(async () => {
    mariaClienteId = await clienteIdPorEmail(admin, "maria@example.com");
    saraClienteId = await clienteIdPorEmail(admin, "sara@example.com");

    const { data: ivan, error: errorIvan } = await admin
      .from("users")
      .select("id")
      .eq("email", "ivan@elefitness.com")
      .single();
    if (errorIvan || !ivan) throw errorIvan ?? new Error("No se encontro a Ivan en el seed");
    ivanId = ivan.id;

    const { data: elena, error: errorElena } = await admin
      .from("users")
      .select("id")
      .eq("email", "elena@elefitness.com")
      .single();
    if (errorElena || !elena) throw errorElena ?? new Error("No se encontro a Elena en el seed");
    elenaId = elena.id;

    // crearClaseConSesion asigna siempre a Ivan; la segunda clase se reasigna
    // a Elena a mano (que ya figura como entrenador_id de varias clases del
    // seed) para tener dos entrenadores distintos que comparar.
    const fixtureIvan = await crearClaseConSesion(admin, { offsetHoras: 60 });
    clasesCreadas.push(fixtureIvan.claseId);
    sesionIvanId = fixtureIvan.sesionId;

    const fixtureElena = await crearClaseConSesion(admin, { offsetHoras: 64 });
    clasesCreadas.push(fixtureElena.claseId);
    sesionElenaId = fixtureElena.sesionId;
    await admin.from("clases").update({ entrenador_id: elenaId }).eq("id", fixtureElena.claseId);
  });

  afterAll(async () => {
    await borrarClases(admin, clasesCreadas);
    // Red de seguridad si algun test fallo antes de restaurar el campo.
    await admin.from("clientes").update({ entrenador_restringido_id: null }).eq("id", mariaClienteId);
  });

  it("una clienta restringida a un entrenador no puede reservar una clase de otro", async () => {
    await admin.from("clientes").update({ entrenador_restringido_id: ivanId }).eq("id", mariaClienteId);

    const maria = await signInAs("maria@example.com");
    const { error } = await maria.rpc("reservar_sesion", {
      p_sesion_id: sesionElenaId,
      p_cliente_id: mariaClienteId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/no es de tu entrenador/);

    await admin.from("clientes").update({ entrenador_restringido_id: null }).eq("id", mariaClienteId);

    const { data: reservas } = await admin
      .from("reservas")
      .select("id")
      .eq("sesion_id", sesionElenaId)
      .eq("cliente_id", mariaClienteId);
    expect(reservas).toEqual([]);
  });

  it("una clienta restringida a un entrenador si puede reservar sus propias clases", async () => {
    await admin.from("clientes").update({ entrenador_restringido_id: ivanId }).eq("id", mariaClienteId);

    const maria = await signInAs("maria@example.com");
    const { data, error } = await maria.rpc("reservar_sesion", {
      p_sesion_id: sesionIvanId,
      p_cliente_id: mariaClienteId,
    });
    expect(error).toBeNull();
    expect(data?.estado).toBe("confirmada");

    await admin.from("clientes").update({ entrenador_restringido_id: null }).eq("id", mariaClienteId);
  });

  it("una clienta sin restriccion (null) puede reservar clases de cualquier entrenador", async () => {
    const { data: cliente } = await admin
      .from("clientes")
      .select("entrenador_restringido_id")
      .eq("id", saraClienteId)
      .single();
    expect(cliente?.entrenador_restringido_id).toBeNull();

    const sara = await signInAs("sara@example.com");
    const { data, error } = await sara.rpc("reservar_sesion", {
      p_sesion_id: sesionElenaId,
      p_cliente_id: saraClienteId,
    });
    expect(error).toBeNull();
    expect(data?.estado).toBe("confirmada");
  });

  it("el admin puede reservar en nombre de una clienta restringida en una clase de otro entrenador", async () => {
    await admin.from("clientes").update({ entrenador_restringido_id: ivanId }).eq("id", mariaClienteId);

    const elena = await signInAs("elena@elefitness.com");
    const { data, error } = await elena.rpc("reservar_sesion", {
      p_sesion_id: sesionElenaId,
      p_cliente_id: mariaClienteId,
    });
    expect(error).toBeNull();
    expect(data?.estado).toBe("confirmada");

    await admin.from("clientes").update({ entrenador_restringido_id: null }).eq("id", mariaClienteId);
  });
});
