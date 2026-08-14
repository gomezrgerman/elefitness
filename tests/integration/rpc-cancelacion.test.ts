import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { borrarClases, clienteIdPorEmail, crearClaseConSesion, signInAs } from "./helpers";

// Reglas de cancelacion confirmadas por Elena el 2026-08-14 (brief-app-centro-entrenamiento.md
// punto 9, migracion 0017) -- invierten lo que estaba construido antes:
//   - Clienta de BONO, cancela >=24h: se devuelve el credito exacto que se
//     consumio al reservar (via reservas.bono_id). No se emite bono de
//     recuperacion ni cuenta contra ningun tope.
//   - Clienta de BONO, cancela <24h: el credito se pierde.
//   - Clienta de MENSUALIDAD, cancela >=24h: se emite un bono de recuperacion
//     (caduca el ultimo dia del mes natural en que se genera), con tope
//     mensual segun dias_semana_habituales
//     (1/mes si 1-2 dias, 2/mes si 3+).
//   - Clienta de MENSUALIDAD, cancela <24h: no pasa nada.
// No se puede reservar ni cancelar contra una sesion ya pasada, ni cancelar
// una reserva con la asistencia ya registrada (sin cambios, migracion 0010/0014).
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

  async function borrarRecuperaciones(clienteId: string) {
    await admin.from("bonos_cliente").delete().eq("cliente_id", clienteId).eq("tipo", "recuperacion");
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
    await borrarRecuperaciones(lauraClienteId);
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
    await borrarRecuperaciones(anaClienteId);
    await borrarRecuperaciones(mariaClienteId);
  });

  afterAll(async () => {
    await borrarClases(admin, clasesCreadas);
    await reiniciarEstadoLaura();
    await borrarRecuperaciones(anaClienteId);
    await borrarRecuperaciones(mariaClienteId);
  });

  it("bono: cancelar con menos de 24h pierde el credito y no emite bono de recuperacion", async () => {
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

    // El credito se pierde: cancelar con menos de 24h no compensa nada.
    expect(await creditosUsadosLaura()).toBe(1);
    expect(await recuperacionesDe(lauraClienteId)).toEqual([]);
  });

  it("bono: cancelar con 24h+ devuelve el credito y no emite bono de recuperacion", async () => {
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

    // El credito exacto que se consumio al reservar vuelve al bono de origen.
    expect(await creditosUsadosLaura()).toBe(0);
    expect(await recuperacionesDe(lauraClienteId)).toEqual([]);
  });

  it("mensual: cancelar con 24h+ emite un bono de recuperacion", async () => {
    await borrarRecuperaciones(anaClienteId);
    const fixture = await crearClaseConSesion(admin, { offsetHoras: 48 });
    clasesCreadas.push(fixture.claseId);

    const ana = await signInAs("ana@example.com");
    const { data: reserva, error: errorReserva } = await ana.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: anaClienteId,
    });
    expect(errorReserva).toBeNull();
    expect(reserva?.estado).toBe("confirmada");

    const { error } = await ana.rpc("cancelar_reserva", { p_reserva_id: reserva!.id });
    expect(error).toBeNull();

    const recuperaciones = await recuperacionesDe(anaClienteId);
    expect(recuperaciones.length).toBe(1);
    const recuperacion = recuperaciones[0];
    expect(recuperacion.creditos_totales).toBe(1);
    expect(recuperacion.creditos_usados).toBe(0);
    expect(recuperacion.plan_id).toBeNull();
    expect(recuperacion.activo).toBe(true);

    // Corregido el 2026-08-14: caduca el ultimo dia del mes natural en que se
    // genera, no a los 14 dias fijos.
    const generado = new Date(`${recuperacion.fecha_compra}T00:00:00Z`);
    const ultimoDiaDelMes = new Date(Date.UTC(generado.getUTCFullYear(), generado.getUTCMonth() + 1, 0));
    expect(recuperacion.fecha_caducidad).toBe(ultimoDiaDelMes.toISOString().slice(0, 10));
  });

  it("mensual: cancelar con menos de 24h no emite ningun bono de recuperacion", async () => {
    await borrarRecuperaciones(anaClienteId);
    const fixture = await crearClaseConSesion(admin, { offsetHoras: 12 });
    clasesCreadas.push(fixture.claseId);

    const ana = await signInAs("ana@example.com");
    const { data: reserva, error: errorReserva } = await ana.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: anaClienteId,
    });
    expect(errorReserva).toBeNull();
    expect(reserva?.estado).toBe("confirmada");

    const { error } = await ana.rpc("cancelar_reserva", { p_reserva_id: reserva!.id });
    expect(error).toBeNull();

    expect(await recuperacionesDe(anaClienteId)).toEqual([]);
  });

  it("tope mensual: Maria (mensual, dias_semana_habituales=3) recibe 2 bonos de recuperacion al mes y no un tercero", async () => {
    await borrarRecuperaciones(mariaClienteId);

    const { data: maria } = await admin
      .from("clientes")
      .select("dias_semana_habituales")
      .eq("id", mariaClienteId)
      .single();
    expect(maria?.dias_semana_habituales).toBe(3);

    const mariaClient = await signInAs("maria@example.com");
    const recuentos: number[] = [];

    for (const offsetHoras of [48, 72, 96]) {
      const fixture = await crearClaseConSesion(admin, { offsetHoras });
      clasesCreadas.push(fixture.claseId);

      const { data: reserva, error: errorReserva } = await mariaClient.rpc("reservar_sesion", {
        p_sesion_id: fixture.sesionId,
        p_cliente_id: mariaClienteId,
      });
      expect(errorReserva).toBeNull();
      expect(reserva?.estado).toBe("confirmada");

      const { error } = await mariaClient.rpc("cancelar_reserva", { p_reserva_id: reserva!.id });
      expect(error).toBeNull();

      recuentos.push((await recuperacionesDe(mariaClienteId)).length);
    }

    // La tercera cancelacion del mes ya no compensa: el tope es 2/mes.
    expect(recuentos).toEqual([1, 2, 2]);
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

  it("no se puede cancelar una reserva de una sesion que acaba de empezar (regresion migracion 0014)", async () => {
    // El test de arriba (offsetHoras: -2) no basta como regresion: en verano
    // (CEST, +2h) el instante "percibido" por el codigo pre-0014 esta 2h por
    // delante del real, asi que a las -2h ambos codigos (el correcto y el
    // revertido) ya coinciden en rechazar la cancelacion -- la diferencia solo
    // es observable dentro de esa ventana de desfase (1h en invierno, 2h en
    // verano). 30min queda comodamente por debajo del desfase minimo posible
    // para detectar la regresion en cualquier epoca del anyo.
    const fixture = await crearClaseConSesion(admin, { offsetHoras: -0.5 });
    clasesCreadas.push(fixture.claseId);

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

    // La asistencia solo se puede marcar sobre una clase ya empezada, y esa
    // tampoco se puede cancelar. Se prepara el estado a mano para comprobar la
    // guarda en aislamiento.
    await admin.from("reservas").update({ asistencia: "asistio" }).eq("id", reserva!.id);

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

  it("no se puede reservar una sesion que acaba de empezar (regresion migracion 0014)", async () => {
    // Misma razon que el test equivalente de cancelar_reserva arriba: offsetHoras
    // -2 no distingue el codigo correcto del revertido en verano, porque a esa
    // distancia el desfase de 0014 (hasta 2h en CEST) ya se ha agotado.
    const fixture = await crearClaseConSesion(admin, { offsetHoras: -0.5 });
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
