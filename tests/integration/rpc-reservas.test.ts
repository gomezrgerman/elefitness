import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { borrarClases, clienteIdPorEmail, crearClaseConSesion, signInAs } from "./helpers";

// Este fichero crea su propia clase/sesion/reservas (via los helpers), igual
// que el resto de la suite. Antes reutilizaba la sesion del miercoles y las
// reservas de Ana/Laura del seed, mutandolas directamente: eso lo dejaba en
// una posicion distinta a todos los demas ficheros (dependiente del estado
// que dejara el seed o una ejecucion previa) y con un afterAll dedicado solo
// a devolver esas filas a su estado original.
describe("reservar_sesion / cancelar_reserva RPC", () => {
  const admin = createAdminClient();
  const clasesCreadas: string[] = [];
  let sesionId: string;
  let saraClienteId: string;
  let anaClienteId: string;
  let lauraClienteId: string;
  let anaReservaId: string;
  let lauraReservaId: string;
  let bonoNormalLauraId: string;

  async function reiniciarEstadoLaura() {
    await admin.from("bonos_cliente").update({ creditos_usados: 0 }).eq("id", bonoNormalLauraId);
    await admin.from("bonos_cliente").delete().eq("cliente_id", lauraClienteId).eq("tipo", "recuperacion");
  }

  beforeAll(async () => {
    saraClienteId = await clienteIdPorEmail(admin, "sara@example.com");
    anaClienteId = await clienteIdPorEmail(admin, "ana@example.com");
    lauraClienteId = await clienteIdPorEmail(admin, "laura@example.com");

    const { data: bono, error: errorBono } = await admin
      .from("bonos_cliente")
      .select("id")
      .eq("cliente_id", lauraClienteId)
      .eq("tipo", "normal")
      .single();
    if (errorBono || !bono) throw errorBono ?? new Error("Laura no tiene bono normal en el seed");
    bonoNormalLauraId = bono.id;
    await reiniciarEstadoLaura();

    // Clase/sesion propia con aforo 1: una unica plaza, ocupada por Ana. Asi
    // la reserva de Laura mas abajo cae en lista_espera sin depender de
    // ninguna sesion ni reserva del seed. 72h dentro de la ventana de reserva
    // de 21 dias y comodamente por encima del corte de 24h de la cancelacion.
    const fixture = await crearClaseConSesion(admin, { offsetHoras: 72, aforoMax: 1 });
    clasesCreadas.push(fixture.claseId);
    sesionId = fixture.sesionId;

    const { data: anaReserva, error: errorAna } = await admin
      .from("reservas")
      .insert({ sesion_id: sesionId, cliente_id: anaClienteId, estado: "confirmada" })
      .select()
      .single();
    if (errorAna || !anaReserva) throw errorAna ?? new Error("No se pudo crear la reserva de Ana");
    anaReservaId = anaReserva.id;

    const laura = await signInAs("laura@example.com");
    const { data: lauraReserva, error: errorLaura } = await laura.rpc("reservar_sesion", {
      p_sesion_id: sesionId,
      p_cliente_id: lauraClienteId,
    });
    if (errorLaura || !lauraReserva) throw errorLaura ?? new Error("No se pudo reservar la plaza de Laura");
    expect(lauraReserva.estado).toBe("lista_espera");
    lauraReservaId = lauraReserva.id;
  });

  afterAll(async () => {
    await borrarClases(admin, clasesCreadas);
    await reiniciarEstadoLaura();
  });

  it("reservar_sesion en una sesion con aforo lleno devuelve lista_espera", async () => {
    const sara = await signInAs("sara@example.com");
    const { data, error } = await sara.rpc("reservar_sesion", {
      p_sesion_id: sesionId, p_cliente_id: saraClienteId,
    });
    expect(error).toBeNull();
    expect(data?.estado).toBe("lista_espera");
  });

  it("reservar con bono sin creditos restantes falla", async () => {
    await admin.from("bonos_cliente").update({ creditos_usados: 10 }).eq("id", bonoNormalLauraId);
    // Sesion propia, sin relacion con la de aforo 1 usada en el resto del
    // fichero: solo hace falta comprobar la guarda de creditos.
    const fixtureSinCreditos = await crearClaseConSesion(admin, { offsetHoras: 96 });
    clasesCreadas.push(fixtureSinCreditos.claseId);

    const laura = await signInAs("laura@example.com");
    const { error } = await laura.rpc("reservar_sesion", {
      p_sesion_id: fixtureSinCreditos.sesionId, p_cliente_id: lauraClienteId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/creditos de bono/);
    await admin.from("bonos_cliente").update({ creditos_usados: 0 }).eq("id", bonoNormalLauraId);
  });

  it("cancelar una reserva confirmada promueve la primera en lista_espera y cobra su credito de bono", async () => {
    const ana = await signInAs("ana@example.com");
    const { data, error } = await ana.rpc("cancelar_reserva", { p_reserva_id: anaReservaId });
    expect(error).toBeNull();
    expect(data?.estado).toBe("cancelada");

    const { data: lauraActualizada } = await admin.from("reservas").select("estado").eq("id", lauraReservaId).single();
    expect(lauraActualizada?.estado).toBe("confirmada");

    const { data: bonoLaura } = await admin.from("bonos_cliente").select("creditos_usados").eq("id", bonoNormalLauraId).single();
    expect(bonoLaura?.creditos_usados).toBe(1);

    // Ana paga cuota mensual: no consume creditos, asi que aunque cancele con
    // 24h+ de antelacion no le corresponde bono de recuperacion (migracion
    // 0010; antes se le emitia uno inerte). El caso con 24h+ de una clienta de
    // bono esta cubierto en rpc-cancelacion.test.ts.
    const { data: bonosRecuperacionAna } = await admin
      .from("bonos_cliente")
      .select("id")
      .eq("cliente_id", anaClienteId)
      .eq("tipo", "recuperacion");
    expect(bonosRecuperacionAna).toEqual([]);
  });

  it("cancelar la reserva promovida de Laura NO devuelve su credito de bono", async () => {
    const laura = await signInAs("laura@example.com");
    const { error } = await laura.rpc("cancelar_reserva", { p_reserva_id: lauraReservaId });
    expect(error).toBeNull();

    // El credito consumido al confirmar la plaza no vuelve al bono de origen:
    // la unica compensacion por cancelar con 24h+ es el bono de recuperacion.
    const { data: bonoLaura } = await admin.from("bonos_cliente").select("creditos_usados").eq("id", bonoNormalLauraId).single();
    expect(bonoLaura?.creditos_usados).toBe(1);

    const { data: recuperaciones } = await admin
      .from("bonos_cliente")
      .select("id")
      .eq("cliente_id", lauraClienteId)
      .eq("tipo", "recuperacion");
    expect(recuperaciones?.length).toBe(1);

    // Al liberarse la plaza, la siguiente en lista de espera (Sara, del primer
    // test de este fichero) pasa a confirmada.
    const { data: reservaSara } = await admin
      .from("reservas")
      .select("estado")
      .eq("sesion_id", sesionId)
      .eq("cliente_id", saraClienteId)
      .single();
    expect(reservaSara?.estado).toBe("confirmada");
  });
});
