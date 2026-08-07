import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { borrarClases, clienteIdPorEmail, crearClaseConSesion, signInAs } from "./helpers";

// Reglas de cancelacion confirmadas por German (migracion 0010):
//   - el credito consumido al reservar NO vuelve nunca al bono de origen;
//   - cancelar con 24h+ compensa con un bono de recuperacion, y solo a quien
//     paga por creditos (plan de tipo 'bono');
//   - cancelar con menos de 24h no compensa nada;
//   - no se puede reservar ni cancelar contra una sesion ya pasada, ni cancelar
//     una reserva con la asistencia ya registrada.
// Cada test crea su propia clase+sesion al offset que necesita (ver
// crearClaseConSesion en helpers.ts) para que la regla no dependa del dia en
// que se ejecute la suite.
describe("Reglas de cancelacion", () => {
  const admin = createAdminClient();
  const clasesCreadas: string[] = [];
  let lauraClienteId: string;
  let anaClienteId: string;
  let mariaClienteId: string;
  let bonoNormalLauraId: string;

  async function borrarRecuperaciones() {
    for (const clienteId of [lauraClienteId, anaClienteId, mariaClienteId]) {
      await admin.from("bonos_cliente").delete().eq("cliente_id", clienteId).eq("tipo", "recuperacion");
    }
  }

  async function recuperacionesDe(clienteId: string) {
    const { data } = await admin
      .from("bonos_cliente")
      .select("*")
      .eq("cliente_id", clienteId)
      .eq("tipo", "recuperacion");
    return data ?? [];
  }

  async function creditosUsadosLaura() {
    const { data } = await admin.from("bonos_cliente").select("creditos_usados").eq("id", bonoNormalLauraId).single();
    return data!.creditos_usados;
  }

  async function reiniciarEstadoLaura() {
    await admin.from("bonos_cliente").update({ creditos_usados: 0 }).eq("id", bonoNormalLauraId);
    await borrarRecuperaciones();
  }

  beforeAll(async () => {
    lauraClienteId = await clienteIdPorEmail(admin, "laura@example.com");
    anaClienteId = await clienteIdPorEmail(admin, "ana@example.com");
    mariaClienteId = await clienteIdPorEmail(admin, "maria@example.com");

    const { data: bono, error } = await admin
      .from("bonos_cliente")
      .select("id")
      .eq("cliente_id", lauraClienteId)
      .eq("tipo", "normal")
      .single();
    if (error || !bono) throw error ?? new Error("Laura no tiene bono normal en el seed");
    bonoNormalLauraId = bono.id;

    await reiniciarEstadoLaura();
  });

  afterAll(async () => {
    await borrarClases(admin, clasesCreadas);
    await reiniciarEstadoLaura();
  });

  it("cancelar con menos de 24h pierde el credito y no emite bono de recuperacion", async () => {
    await reiniciarEstadoLaura();
    const fixture = await crearClaseConSesion(admin, { offsetHoras: 12 });
    clasesCreadas.push(fixture.claseId);

    const laura = await signInAs("laura@example.com");
    const { data: reserva, error: errorReserva } = await laura.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: lauraClienteId,
    });
    expect(errorReserva).toBeNull();
    expect(reserva?.estado).toBe("confirmada");
    expect(await creditosUsadosLaura()).toBe(1);

    const { error } = await laura.rpc("cancelar_reserva", { p_reserva_id: reserva!.id });
    expect(error).toBeNull();

    // El credito se pierde: es exactamente la fuga que cierra la migracion 0010.
    expect(await creditosUsadosLaura()).toBe(1);
    expect(await recuperacionesDe(lauraClienteId)).toEqual([]);
  });

  it("cancelar con 24h+ emite un bono de recuperacion y tampoco devuelve el credito original", async () => {
    await reiniciarEstadoLaura();
    const fixture = await crearClaseConSesion(admin, { offsetHoras: 48 });
    clasesCreadas.push(fixture.claseId);

    const laura = await signInAs("laura@example.com");
    const { data: reserva, error: errorReserva } = await laura.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: lauraClienteId,
    });
    expect(errorReserva).toBeNull();
    expect(reserva?.estado).toBe("confirmada");
    expect(await creditosUsadosLaura()).toBe(1);

    const { error } = await laura.rpc("cancelar_reserva", { p_reserva_id: reserva!.id });
    expect(error).toBeNull();

    // El bono de recuperacion es la UNICA compensacion: el credito del bono
    // original sigue consumido.
    expect(await creditosUsadosLaura()).toBe(1);

    const recuperaciones = await recuperacionesDe(lauraClienteId);
    expect(recuperaciones.length).toBe(1);
    const recuperacion = recuperaciones[0];
    expect(recuperacion.creditos_totales).toBe(1);
    expect(recuperacion.creditos_usados).toBe(0);
    expect(recuperacion.plan_id).toBeNull();
    expect(recuperacion.activo).toBe(true);

    const caducidadEsperada = new Date(`${recuperacion.fecha_compra}T00:00:00Z`);
    caducidadEsperada.setUTCDate(caducidadEsperada.getUTCDate() + 14);
    expect(recuperacion.fecha_caducidad).toBe(caducidadEsperada.toISOString().slice(0, 10));
  });

  it("una clienta de plan mensual no recibe bono de recuperacion al cancelar con 24h+", async () => {
    const fixture = await crearClaseConSesion(admin, { offsetHoras: 48 });
    clasesCreadas.push(fixture.claseId);
    await admin.from("bonos_cliente").delete().eq("cliente_id", anaClienteId).eq("tipo", "recuperacion");

    const ana = await signInAs("ana@example.com");
    const { data: reserva, error: errorReserva } = await ana.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: anaClienteId,
    });
    expect(errorReserva).toBeNull();
    expect(reserva?.estado).toBe("confirmada");

    const { error } = await ana.rpc("cancelar_reserva", { p_reserva_id: reserva!.id });
    expect(error).toBeNull();

    // Ana paga cuota mensual: no consume creditos, asi que un bono de
    // recuperacion seria inerte y solo confundiria en pantalla.
    expect(await recuperacionesDe(anaClienteId)).toEqual([]);
  });

  it("tope mensual: Laura (dias_semana_habituales=3) recibe 2 bonos de recuperacion al mes y no un tercero", async () => {
    await reiniciarEstadoLaura();

    const { data: laura } = await admin
      .from("clientes")
      .select("dias_semana_habituales")
      .eq("id", lauraClienteId)
      .single();
    expect(laura?.dias_semana_habituales).toBe(3);

    const lauraClient = await signInAs("laura@example.com");
    const recuentos: number[] = [];

    for (const offsetHoras of [48, 72, 96]) {
      const fixture = await crearClaseConSesion(admin, { offsetHoras });
      clasesCreadas.push(fixture.claseId);

      const { data: reserva, error: errorReserva } = await lauraClient.rpc("reservar_sesion", {
        p_sesion_id: fixture.sesionId,
        p_cliente_id: lauraClienteId,
      });
      expect(errorReserva).toBeNull();
      expect(reserva?.estado).toBe("confirmada");

      const { error } = await lauraClient.rpc("cancelar_reserva", { p_reserva_id: reserva!.id });
      expect(error).toBeNull();

      recuentos.push((await recuperacionesDe(lauraClienteId)).length);
    }

    // La tercera cancelacion del mes ya no compensa: el tope es 2/mes.
    expect(recuentos).toEqual([1, 2, 2]);

    // Ninguno de los tres creditos vuelve. Se suma sobre todos los bonos porque
    // el bono de recuperacion caduca a 14 dias — antes que el bono normal del
    // seed — asi que reservar_sesion cobra la segunda y la tercera reserva
    // contra los propios bonos de recuperacion, no contra el bono normal.
    const { data: bonosLaura } = await admin
      .from("bonos_cliente")
      .select("creditos_usados")
      .eq("cliente_id", lauraClienteId);
    const usadosTotales = (bonosLaura ?? []).reduce((suma, bono) => suma + bono.creditos_usados, 0);
    expect(usadosTotales).toBe(3);
    expect(await creditosUsadosLaura()).toBe(1);
  });

  it("no se puede cancelar una reserva de una sesion que ya ha pasado", async () => {
    const fixture = await crearClaseConSesion(admin, { offsetHoras: -2 });
    clasesCreadas.push(fixture.claseId);

    // La reserva se inserta directamente: reservar_sesion ya rechaza el pasado.
    const { data: reserva, error: errorInsert } = await admin
      .from("reservas")
      .insert({ sesion_id: fixture.sesionId, cliente_id: mariaClienteId, estado: "confirmada" })
      .select()
      .single();
    expect(errorInsert).toBeNull();

    const maria = await signInAs("maria@example.com");
    const { error } = await maria.rpc("cancelar_reserva", { p_reserva_id: reserva!.id });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/ya ha pasado/);

    const { data: sigueViva } = await admin.from("reservas").select("estado").eq("id", reserva!.id).single();
    expect(sigueViva?.estado).toBe("confirmada");
  });

  it("no se puede cancelar una reserva con la asistencia ya registrada", async () => {
    const fixture = await crearClaseConSesion(admin, { offsetHoras: 48 });
    clasesCreadas.push(fixture.claseId);

    const maria = await signInAs("maria@example.com");
    const { data: reserva, error: errorReserva } = await maria.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: mariaClienteId,
    });
    expect(errorReserva).toBeNull();

    const ivan = await signInAs("ivan@elefitness.com");
    // p_asistio = true a proposito: 'no_asistio' incrementaria deuda_creditos y
    // este test no va de eso.
    const { data: marcada, error: errorAsistencia } = await ivan.rpc("marcar_asistencia", {
      p_reserva_id: reserva!.id,
      p_asistio: true,
    });
    expect(errorAsistencia).toBeNull();
    expect(marcada?.asistencia).toBe("asistio");

    const { error } = await maria.rpc("cancelar_reserva", { p_reserva_id: reserva!.id });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/asistencia ya registrada/);

    const { data: sigueViva } = await admin.from("reservas").select("estado").eq("id", reserva!.id).single();
    expect(sigueViva?.estado).toBe("confirmada");
  });

  it("no se puede reservar una sesion que ya ha pasado", async () => {
    const fixture = await crearClaseConSesion(admin, { offsetHoras: -2 });
    clasesCreadas.push(fixture.claseId);

    const maria = await signInAs("maria@example.com");
    const { error } = await maria.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: mariaClienteId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/ya ha pasado/);

    const { data: reservas } = await admin.from("reservas").select("id").eq("sesion_id", fixture.sesionId);
    expect(reservas).toEqual([]);
  });
});
