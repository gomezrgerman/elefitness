import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { borrarClases, clienteIdPorEmail, crearClaseConSesion, instanteUtc, signInAs } from "./helpers";

// Cobertura del trigger de la migracion 0007: cada movimiento de una reserva
// deja una linea en reservas_historial, que es lo que alimenta el registro
// completo de la ficha de clase (no solo el estado actual).
describe("trigger reservas_historial", () => {
  const admin = createAdminClient();
  const clasesCreadas: string[] = [];
  let mariaClienteId: string;
  let anaClienteId: string;
  let saraClienteId: string;
  let sesionId: string;
  let reservaMariaId: string;
  let reservaAnaId: string;
  let reservaSaraId: string;

  async function eventosDe(reservaId: string): Promise<string[]> {
    const { data, error } = await admin
      .from("reservas_historial")
      .select("evento, creado_en")
      .eq("reserva_id", reservaId)
      .order("creado_en", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((fila) => fila.evento);
  }

  beforeAll(async () => {
    mariaClienteId = await clienteIdPorEmail(admin, "maria@example.com");
    anaClienteId = await clienteIdPorEmail(admin, "ana@example.com");
    saraClienteId = await clienteIdPorEmail(admin, "sara@example.com");

    // aforo 2 para que la tercera reserva caiga en lista de espera y luego
    // pueda ser promovida al cancelar una de las confirmadas.
    const fixture = await crearClaseConSesion(admin, { offsetHoras: 48, aforoMax: 2 });
    clasesCreadas.push(fixture.claseId);
    sesionId = fixture.sesionId;
  });

  afterAll(async () => {
    await borrarClases(admin, clasesCreadas);
    await admin.from("clientes").update({ deuda_creditos: 0 }).eq("id", saraClienteId);
  });

  it("reservar con hueco escribe 'apuntado'", async () => {
    const maria = await signInAs("maria@example.com");
    const { data, error } = await maria.rpc("reservar_sesion", {
      p_sesion_id: sesionId,
      p_cliente_id: mariaClienteId,
    });
    reservaMariaId = data!.id;
    expect(error).toBeNull();
    expect(data?.estado).toBe("confirmada");

    expect(await eventosDe(reservaMariaId)).toEqual(["apuntado"]);
  });

  it("reservar sin hueco escribe 'en_lista_espera'", async () => {
    const ana = await signInAs("ana@example.com");
    const { data: reservaAna, error: errorAna } = await ana.rpc("reservar_sesion", {
      p_sesion_id: sesionId,
      p_cliente_id: anaClienteId,
    });
    reservaAnaId = reservaAna!.id;
    expect(errorAna).toBeNull();
    expect(reservaAna?.estado).toBe("confirmada");

    const sara = await signInAs("sara@example.com");
    const { data: reservaSara, error: errorSara } = await sara.rpc("reservar_sesion", {
      p_sesion_id: sesionId,
      p_cliente_id: saraClienteId,
    });
    reservaSaraId = reservaSara!.id;
    expect(errorSara).toBeNull();
    expect(reservaSara?.estado).toBe("lista_espera");

    expect(await eventosDe(reservaAnaId)).toEqual(["apuntado"]);
    expect(await eventosDe(reservaSaraId)).toEqual(["en_lista_espera"]);
  });

  it("cancelar escribe 'desapuntado' y la promocion escribe 'promovido_desde_lista_espera'", async () => {
    const maria = await signInAs("maria@example.com");
    const { error } = await maria.rpc("cancelar_reserva", { p_reserva_id: reservaMariaId });
    expect(error).toBeNull();

    expect(await eventosDe(reservaMariaId)).toEqual(["apuntado", "desapuntado"]);
    expect(await eventosDe(reservaSaraId)).toEqual(["en_lista_espera", "promovido_desde_lista_espera"]);
  });

  it("marcar asistencia escribe 'asistio' / 'no_asistio'", async () => {
    // La sesion se creo 48h en el futuro para que las reservas anteriores
    // pudieran hacerse (reservar_sesion rechaza el pasado). marcar_asistencia
    // exige lo contrario: la clase ya tiene que haber empezado. Se mueve la
    // sesion al pasado justo antes de este test, con margen de sobra (50h)
    // para que el resultado no dependa de la hora del dia en que corra la
    // suite. El dia de la semana de la sesion deja de coincidir con el de la
    // clase tras este cambio, pero ninguna de las RPCs ni ninguna asercion de
    // este test depende de eso.
    const pasada = instanteUtc(-50);
    await admin.from("sesiones").update({ fecha: pasada.fecha }).eq("id", sesionId);

    const ivan = await signInAs("ivan@elefitness.com");

    const { error: errorAna } = await ivan.rpc("marcar_asistencia", {
      p_reserva_id: reservaAnaId,
      p_asistencia: "asistio",
    });
    expect(errorAna).toBeNull();
    expect(await eventosDe(reservaAnaId)).toEqual(["apuntado", "asistio"]);

    const { error: errorSara } = await ivan.rpc("marcar_asistencia", {
      p_reserva_id: reservaSaraId,
      p_asistencia: "no_asistio",
    });
    expect(errorSara).toBeNull();
    expect(await eventosDe(reservaSaraId)).toEqual([
      "en_lista_espera",
      "promovido_desde_lista_espera",
      "no_asistio",
    ]);
  });
});
