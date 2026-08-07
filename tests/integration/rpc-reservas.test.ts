import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { signInAs } from "./helpers";

describe("reservar_sesion / cancelar_reserva RPC", () => {
  const admin = createAdminClient();
  let sesionMiercolesId: string;
  let saraClienteId: string;
  let anaClienteId: string;
  let lauraClienteId: string;
  let anaReservaId: string;
  let lauraReservaId: string;

  beforeAll(async () => {
    const { data: clase } = await admin.from("clases").select("id").eq("dia", "miercoles").single();
    const { data: sesion } = await admin.from("sesiones").select("id").eq("clase_id", clase!.id).order("fecha", { ascending: true }).limit(1).single();
    sesionMiercolesId = sesion!.id;

    async function clienteIdPorEmail(email: string): Promise<string> {
      const { data: usuario } = await admin.from("users").select("id").eq("email", email).single();
      const { data: cliente } = await admin.from("clientes").select("id").eq("usuario_id", usuario!.id).single();
      return cliente!.id;
    }

    saraClienteId = await clienteIdPorEmail("sara@example.com");
    anaClienteId = await clienteIdPorEmail("ana@example.com");
    lauraClienteId = await clienteIdPorEmail("laura@example.com");

    const { data: anaReserva } = await admin
      .from("reservas").select("id")
      .eq("sesion_id", sesionMiercolesId).eq("cliente_id", anaClienteId).single();
    anaReservaId = anaReserva!.id;

    const { data: lauraReserva } = await admin
      .from("reservas").select("id")
      .eq("sesion_id", sesionMiercolesId).eq("cliente_id", lauraClienteId).single();
    lauraReservaId = lauraReserva!.id;
  });

  afterAll(async () => {
    await admin.from("reservas").delete().eq("sesion_id", sesionMiercolesId).eq("cliente_id", saraClienteId);
    await admin.from("reservas").update({ estado: "confirmada" }).eq("id", anaReservaId);
    await admin.from("reservas").update({ estado: "lista_espera" }).eq("id", lauraReservaId);
    await admin.from("bonos_cliente").update({ creditos_usados: 0 }).eq("cliente_id", lauraClienteId).eq("tipo", "normal");
    await admin.from("bonos_cliente").delete().eq("cliente_id", lauraClienteId).eq("tipo", "recuperacion");
    await admin.from("bonos_cliente").delete().eq("cliente_id", anaClienteId).eq("tipo", "recuperacion");
  });

  it("reservar_sesion en una sesion con aforo lleno devuelve lista_espera", async () => {
    const sara = await signInAs("sara@example.com");
    const { data, error } = await sara.rpc("reservar_sesion", {
      p_sesion_id: sesionMiercolesId, p_cliente_id: saraClienteId,
    });
    expect(error).toBeNull();
    expect(data?.estado).toBe("lista_espera");
  });

  it("reservar con bono sin creditos restantes falla", async () => {
    await admin.from("bonos_cliente").update({ creditos_usados: 10 }).eq("cliente_id", lauraClienteId).eq("tipo", "normal");
    const laura = await signInAs("laura@example.com");
    const { data: claseLunes } = await admin.from("clases").select("id").eq("dia", "lunes").single();
    const { data: sesionLunes } = await admin.from("sesiones").select("id").eq("clase_id", claseLunes!.id).limit(1).single();
    const { error } = await laura.rpc("reservar_sesion", {
      p_sesion_id: sesionLunes!.id, p_cliente_id: lauraClienteId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/creditos de bono/);
    await admin.from("bonos_cliente").update({ creditos_usados: 0 }).eq("cliente_id", lauraClienteId).eq("tipo", "normal");
  });

  it("cancelar una reserva confirmada promueve la primera en lista_espera y cobra su credito de bono", async () => {
    const ana = await signInAs("ana@example.com");
    const { data, error } = await ana.rpc("cancelar_reserva", { p_reserva_id: anaReservaId });
    expect(error).toBeNull();
    expect(data?.estado).toBe("cancelada");

    const { data: lauraActualizada } = await admin.from("reservas").select("estado").eq("id", lauraReservaId).single();
    expect(lauraActualizada?.estado).toBe("confirmada");

    const { data: bonoLaura } = await admin.from("bonos_cliente").select("creditos_usados").eq("cliente_id", lauraClienteId).eq("tipo", "normal").single();
    expect(bonoLaura?.creditos_usados).toBe(1);

    // Cancelar con 24h+ de antelacion (sesionMiercolesId es varios dias en el
    // futuro, ver siguienteFecha() en scripts/seed.ts) debe emitir un bono de
    // recuperacion de 1 credito que caduca a los 14 dias.
    const { data: bonoRecuperacionAna } = await admin
      .from("bonos_cliente")
      .select("*")
      .eq("cliente_id", anaClienteId)
      .eq("tipo", "recuperacion")
      .single();
    expect(bonoRecuperacionAna).not.toBeNull();
    expect(bonoRecuperacionAna?.creditos_totales).toBe(1);
    expect(bonoRecuperacionAna?.creditos_usados).toBe(0);
    expect(bonoRecuperacionAna?.activo).toBe(true);
    expect(bonoRecuperacionAna?.plan_id).toBeNull();

    const fechaCompra = new Date(`${bonoRecuperacionAna!.fecha_compra}T00:00:00Z`);
    const caducidadEsperada = new Date(fechaCompra);
    caducidadEsperada.setUTCDate(caducidadEsperada.getUTCDate() + 14);
    expect(bonoRecuperacionAna?.fecha_caducidad).toBe(caducidadEsperada.toISOString().slice(0, 10));
  });

  it("una segunda cancelacion con 24h+ de Ana en el mismo mes no crea un segundo bono de recuperacion (tope mensual 1, dias_semana_habituales=2)", async () => {
    // Ana ya tiene un bono de recuperacion de este mes (test anterior). Su
    // dias_semana_habituales es 2 (seed.ts), por lo que el tope mensual es 1.
    // Creamos una segunda sesion+reserva confirmada solo para este test,
    // bien alejada en el tiempo para no chocar con la ventana de 24h.
    const { data: usuarioIvan } = await admin.from("users").select("id").eq("email", "ivan@elefitness.com").single();

    const base = new Date();
    base.setDate(base.getDate() + 10);
    const fechaSesionExtra = base.toISOString().slice(0, 10);

    const { data: claseExtra } = await admin
      .from("clases")
      .insert({ dia: "domingo", hora_inicio: "09:00", hora_fin: "10:00", aforo_max: 5, entrenador_id: usuarioIvan!.id, recurrente: true })
      .select()
      .single();

    const { data: sesionExtra } = await admin
      .from("sesiones")
      .insert({ clase_id: claseExtra!.id, fecha: fechaSesionExtra })
      .select()
      .single();

    const { data: reservaExtra } = await admin
      .from("reservas")
      .insert({ sesion_id: sesionExtra!.id, cliente_id: anaClienteId, estado: "confirmada" })
      .select()
      .single();

    try {
      const ana = await signInAs("ana@example.com");
      const { error } = await ana.rpc("cancelar_reserva", { p_reserva_id: reservaExtra!.id });
      expect(error).toBeNull();

      const { data: bonosRecuperacionAna } = await admin
        .from("bonos_cliente")
        .select("id")
        .eq("cliente_id", anaClienteId)
        .eq("tipo", "recuperacion");
      expect(bonosRecuperacionAna?.length).toBe(1);
    } finally {
      await admin.from("clases").delete().eq("id", claseExtra!.id);
    }
  });

  it("cancelar la reserva promovida de Laura devuelve su credito de bono", async () => {
    const laura = await signInAs("laura@example.com");
    const { error } = await laura.rpc("cancelar_reserva", { p_reserva_id: lauraReservaId });
    expect(error).toBeNull();

    const { data: bonoLaura } = await admin.from("bonos_cliente").select("creditos_usados").eq("cliente_id", lauraClienteId).eq("tipo", "normal").single();
    expect(bonoLaura?.creditos_usados).toBe(0);
  });
});
