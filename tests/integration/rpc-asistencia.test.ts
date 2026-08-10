import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { borrarClases, clienteIdPorEmail, crearClaseConSesion, signInAs } from "./helpers";

describe("marcar_asistencia RPC", () => {
  const admin = createAdminClient();
  const clasesCreadas: string[] = [];
  let mariaClienteId: string;
  let reservaPasadaId: string;
  let reservaFuturaId: string;

  beforeAll(async () => {
    mariaClienteId = await clienteIdPorEmail(admin, "maria@example.com");

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

    // Una clase que aun no ha empezado, para la guarda de fecha.
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
    const { error } = await ivan.rpc("marcar_asistencia", {
      p_reserva_id: reservaPasadaId,
      p_asistencia: "asistio",
    });
    expect(error).toBeNull();

    const { data: cliente } = await admin.from("clientes").select("deuda_creditos").eq("id", mariaClienteId).single();
    expect(cliente?.deuda_creditos).toBe(0);
  });

  it("no se puede marcar la asistencia de una clase que aun no ha empezado", async () => {
    const ivan = await signInAs("ivan@elefitness.com");
    const { error } = await ivan.rpc("marcar_asistencia", {
      p_reserva_id: reservaFuturaId,
      p_asistencia: "asistio",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/todavia no ha empezado/);

    const { data: reserva } = await admin.from("reservas").select("asistencia").eq("id", reservaFuturaId).single();
    expect(reserva?.asistencia).toBe("pendiente");
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
