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
  let inicioFichero: string;

  beforeAll(async () => {
    inicioFichero = new Date().toISOString();

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

    // Punto de partida conocido: las aserciones sobre bonos de recuperacion
    // cuentan filas, asi que no pueden heredar las que dejara otro fichero.
    await admin.from("bonos_cliente").update({ creditos_usados: 0 }).eq("cliente_id", lauraClienteId).eq("tipo", "normal");
    await admin.from("bonos_cliente").delete().eq("cliente_id", lauraClienteId).eq("tipo", "recuperacion");
    await admin.from("bonos_cliente").delete().eq("cliente_id", anaClienteId).eq("tipo", "recuperacion");
  });

  afterAll(async () => {
    await admin.from("reservas").delete().eq("sesion_id", sesionMiercolesId).eq("cliente_id", saraClienteId);
    await admin.from("reservas").update({ estado: "confirmada" }).eq("id", anaReservaId);
    await admin.from("reservas").update({ estado: "lista_espera" }).eq("id", lauraReservaId);
    // Este es el unico fichero que muta reservas del seed en vez de crear las
    // suyas: cancelarlas y restaurarlas deja rastro en reservas_historial (el
    // trigger de 0007 dispara tambien en el UPDATE de restauracion). Sin esto
    // el historial de las reservas del seed crece en cada ejecucion.
    await admin
      .from("reservas_historial")
      .delete()
      .in("reserva_id", [anaReservaId, lauraReservaId])
      .gte("creado_en", inicioFichero);
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
    const { data: bonoLaura } = await admin.from("bonos_cliente").select("creditos_usados").eq("cliente_id", lauraClienteId).eq("tipo", "normal").single();
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
      .eq("sesion_id", sesionMiercolesId)
      .eq("cliente_id", saraClienteId)
      .single();
    expect(reservaSara?.estado).toBe("confirmada");
  });
});
