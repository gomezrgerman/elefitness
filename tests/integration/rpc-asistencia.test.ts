import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { borrarClases, clienteIdPorEmail, crearClaseConSesion, signInAs } from "./helpers";

describe("marcar_asistencia RPC", () => {
  const admin = createAdminClient();
  const clasesCreadas: string[] = [];
  let mariaClienteId: string;
  let saraClienteId: string;
  let anaClienteId: string;
  let reservaPasadaId: string;
  let reservaFuturaId: string;
  let reservaListaEsperaId: string;
  let reservaIdempotenciaId: string;

  beforeAll(async () => {
    mariaClienteId = await clienteIdPorEmail(admin, "maria@example.com");
    saraClienteId = await clienteIdPorEmail(admin, "sara@example.com");
    anaClienteId = await clienteIdPorEmail(admin, "ana@example.com");

    // El fichero deja deuda_creditos en 0 en su propio afterAll, pero eso solo
    // cubre una ejecucion previa completa. Se fija aqui tambien para que el
    // fichero no dependa de ese afterAll si se corre en aislamiento o tras un
    // fallo a mitad de la suite anterior.
    await admin.from("clientes").update({ deuda_creditos: 0 }).eq("id", mariaClienteId);

    // Una clase que ya empezo (hace 3h): es la unica sobre la que se puede
    // marcar asistencia.
    const pasada = await crearClaseConSesion(admin, { offsetHoras: -3 });
    clasesCreadas.push(pasada.claseId);
    const { data: rPasada } = await admin
      .from("reservas")
      .insert({ sesion_id: pasada.sesionId, cliente_id: mariaClienteId, estado: "confirmada" })
      .select()
      .single();
    reservaPasadaId = rPasada!.id;

    // Una reserva en lista de espera sobre la misma sesion (ya empezada), para
    // la guarda de estado: marcar_asistencia solo opera sobre 'confirmada'.
    const { data: rListaEspera } = await admin
      .from("reservas")
      .insert({ sesion_id: pasada.sesionId, cliente_id: saraClienteId, estado: "lista_espera" })
      .select()
      .single();
    reservaListaEsperaId = rListaEspera!.id;

    // Una reserva confirmada dedicada a la prueba de idempotencia, para no
    // interferir con el historial de reservaPasadaId que otros tests mutan.
    const { data: rIdempotencia } = await admin
      .from("reservas")
      .insert({ sesion_id: pasada.sesionId, cliente_id: anaClienteId, estado: "confirmada" })
      .select()
      .single();
    reservaIdempotenciaId = rIdempotencia!.id;

    // Una clase que aun no ha empezado: desde la migracion 0020 tambien se
    // puede marcar asistencia en ella (Elena pidio poder registrarla en
    // cuanto llega la clienta, incluso unos minutos antes de la hora).
    const futura = await crearClaseConSesion(admin, { offsetHoras: 48 });
    clasesCreadas.push(futura.claseId);
    const { data: rFutura } = await admin
      .from("reservas")
      .insert({ sesion_id: futura.sesionId, cliente_id: mariaClienteId, estado: "confirmada" })
      .select()
      .single();
    reservaFuturaId = rFutura!.id;
  });

  afterAll(async () => {
    await borrarClases(admin, clasesCreadas);
    await admin.from("clientes").update({ deuda_creditos: 0 }).eq("id", mariaClienteId);
    await admin.from("clientes").update({ deuda_creditos: 0 }).eq("id", anaClienteId);
  });

  it("un cliente no puede marcar asistencia", async () => {
    const sara = await signInAs("sara@example.com");
    const { error } = await sara.rpc("marcar_asistencia", {
      p_reserva_id: reservaPasadaId,
      p_asistencia: "asistio",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/No autorizado/);
  });

  it("no se puede marcar asistencia de una reserva que no esta confirmada", async () => {
    const ivan = await signInAs("ivan@elefitness.com");
    const { error } = await ivan.rpc("marcar_asistencia", {
      p_reserva_id: reservaListaEsperaId,
      p_asistencia: "asistio",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/Solo se puede marcar asistencia de una reserva confirmada/);

    const { data: reserva } = await admin
      .from("reservas")
      .select("asistencia")
      .eq("id", reservaListaEsperaId)
      .single();
    expect(reserva?.asistencia).toBe("pendiente");
  });

  it("el entrenador puede marcar asistio, y no genera deuda", async () => {
    const ivan = await signInAs("ivan@elefitness.com");
    const { data, error } = await ivan.rpc("marcar_asistencia", {
      p_reserva_id: reservaPasadaId,
      p_asistencia: "asistio",
    });
    expect(error).toBeNull();
    expect(data?.asistencia).toBe("asistio");

    const { data: cliente } = await admin.from("clientes").select("deuda_creditos").eq("id", mariaClienteId).single();
    expect(cliente?.deuda_creditos).toBe(0);
  });

  it("pasar de asistio a no_asistio suma una falta", async () => {
    const ivan = await signInAs("ivan@elefitness.com");
    const { data, error } = await ivan.rpc("marcar_asistencia", {
      p_reserva_id: reservaPasadaId,
      p_asistencia: "no_asistio",
    });
    expect(error).toBeNull();
    expect(data?.asistencia).toBe("no_asistio");

    const { data: cliente } = await admin.from("clientes").select("deuda_creditos").eq("id", mariaClienteId).single();
    expect(cliente?.deuda_creditos).toBe(1);
  });

  it("volver a pendiente quita la falta y deja la reserva como estaba", async () => {
    const elena = await signInAs("elena@elefitness.com");
    const { data, error } = await elena.rpc("marcar_asistencia", {
      p_reserva_id: reservaPasadaId,
      p_asistencia: "pendiente",
    });
    expect(error).toBeNull();
    expect(data?.asistencia).toBe("pendiente");
    expect(data?.estado).toBe("confirmada");

    const { data: cliente } = await admin.from("clientes").select("deuda_creditos").eq("id", mariaClienteId).single();
    expect(cliente?.deuda_creditos).toBe(0);
  });

  it("pasar de no_asistio a asistio quita la falta sin dejarla en negativo", async () => {
    const ivan = await signInAs("ivan@elefitness.com");
    await ivan.rpc("marcar_asistencia", { p_reserva_id: reservaPasadaId, p_asistencia: "no_asistio" });

    // Se fuerza deuda_creditos a 0 por fuera de la RPC: la transicion siguiente
    // (no_asistio -> asistio, delta -1) tiene asi que aplicar de verdad el
    // suelo de greatest(0, ...). Con el delta normal (1 -> 0) el test pasaria
    // igual aunque el suelo no existiera, que es justo el hueco que este ajuste
    // cierra.
    await admin.from("clientes").update({ deuda_creditos: 0 }).eq("id", mariaClienteId);

    const { error } = await ivan.rpc("marcar_asistencia", {
      p_reserva_id: reservaPasadaId,
      p_asistencia: "asistio",
    });
    expect(error).toBeNull();

    const { data: cliente } = await admin.from("clientes").select("deuda_creditos").eq("id", mariaClienteId).single();
    expect(cliente?.deuda_creditos).toBe(0);
  });

  it("marcar el mismo estado dos veces es idempotente: no duplica la deuda ni el historial", async () => {
    const ivan = await signInAs("ivan@elefitness.com");

    const primera = await ivan.rpc("marcar_asistencia", {
      p_reserva_id: reservaIdempotenciaId,
      p_asistencia: "no_asistio",
    });
    expect(primera.error).toBeNull();
    const segunda = await ivan.rpc("marcar_asistencia", {
      p_reserva_id: reservaIdempotenciaId,
      p_asistencia: "no_asistio",
    });
    expect(segunda.error).toBeNull();

    const { data: cliente } = await admin.from("clientes").select("deuda_creditos").eq("id", anaClienteId).single();
    expect(cliente?.deuda_creditos).toBe(1);

    const { data: eventos } = await admin
      .from("reservas_historial")
      .select("evento")
      .eq("reserva_id", reservaIdempotenciaId)
      .order("creado_en", { ascending: true });
    expect(eventos?.map((e) => e.evento)).toEqual(["apuntado", "no_asistio"]);
  });

  it("se puede marcar la asistencia de una clase que aun no ha empezado (migracion 0020)", async () => {
    const ivan = await signInAs("ivan@elefitness.com");
    const { data, error } = await ivan.rpc("marcar_asistencia", {
      p_reserva_id: reservaFuturaId,
      p_asistencia: "asistio",
    });
    expect(error).toBeNull();
    expect(data?.asistencia).toBe("asistio");
  });

  it("el historial anota la correccion al volver a pendiente", async () => {
    const { data: eventos } = await admin
      .from("reservas_historial")
      .select("evento")
      .eq("reserva_id", reservaPasadaId)
      .order("creado_en", { ascending: true });
    expect(eventos?.map((e) => e.evento)).toContain("asistencia_corregida");
  });
});
