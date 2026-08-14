import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { borrarClases, clienteIdPorEmail, crearClaseConSesion, signInAs } from "./helpers";

describe("aforo_efectivo y promocion desde lista de espera", () => {
  const admin = createAdminClient();
  const clasesCreadas: string[] = [];
  const bonosCreados: string[] = [];
  let mariaClienteId: string;
  let saraClienteId: string;
  let lauraClienteId: string;
  let bonoNormalLauraId: string;
  let planBonoId: string;

  beforeAll(async () => {
    mariaClienteId = await clienteIdPorEmail(admin, "maria@example.com");
    saraClienteId = await clienteIdPorEmail(admin, "sara@example.com");
    lauraClienteId = await clienteIdPorEmail(admin, "laura@example.com");

    const { data: plan, error: errorPlan } = await admin.from("planes").select("id").eq("tipo", "bono").limit(1).single();
    if (errorPlan || !plan) throw errorPlan ?? new Error("No hay plan de tipo bono en el seed");
    planBonoId = plan.id;

    const { data: bono, error: errorBono } = await admin
      .from("bonos_cliente")
      .select("id")
      .eq("cliente_id", lauraClienteId)
      .eq("tipo", "normal")
      .single();
    if (errorBono || !bono) throw errorBono ?? new Error("Laura no tiene bono normal en el seed");
    bonoNormalLauraId = bono.id;

    await admin.from("bonos_cliente").update({ creditos_usados: 0 }).eq("id", bonoNormalLauraId);
  });

  afterAll(async () => {
    await borrarClases(admin, clasesCreadas);
    for (const id of bonosCreados) await admin.from("bonos_cliente").delete().eq("id", id);
    await admin.from("bonos_cliente").update({ creditos_usados: 0 }).eq("id", bonoNormalLauraId);
    for (const clienteId of [mariaClienteId, saraClienteId, lauraClienteId]) {
      await admin.from("bonos_cliente").delete().eq("cliente_id", clienteId).eq("tipo", "recuperacion");
    }
  });

  it("aforo_efectivo de la sesion manda sobre aforo_max de la clase", async () => {
    // aforo_max = 5 pero aforo_efectivo = 1: sin el override, la segunda
    // reserva saldria confirmada.
    const fixture = await crearClaseConSesion(admin, { offsetHoras: 48, aforoMax: 5, aforoEfectivo: 1 });
    clasesCreadas.push(fixture.claseId);

    const maria = await signInAs("maria@example.com");
    const { data: primera, error: errorPrimera } = await maria.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: mariaClienteId,
    });
    expect(errorPrimera).toBeNull();
    expect(primera?.estado).toBe("confirmada");

    const sara = await signInAs("sara@example.com");
    const { data: segunda, error: errorSegunda } = await sara.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: saraClienteId,
    });
    expect(errorSegunda).toBeNull();
    expect(segunda?.estado).toBe("lista_espera");

    const { data: clase } = await admin.from("clases").select("aforo_max").eq("id", fixture.claseId).single();
    expect(clase?.aforo_max).toBe(5);
  });

  it("la promocion elige a la clienta con creditos aunque su bono de caducidad mas proxima este agotado", async () => {
    // Regresion de la migracion 0010: el SELECT del bono a cobrar al promover
    // no filtraba por creditos restantes, cogia el de caducidad mas proxima y,
    // si estaba agotado, saltaba a la clienta pese a tener creditos en otro bono.
    const hoy = new Date();
    const fechaCompra = hoy.toISOString().slice(0, 10);
    const caducidadProxima = new Date(hoy);
    caducidadProxima.setUTCDate(caducidadProxima.getUTCDate() + 3);

    const { data: bonoAgotado, error: errorBonoAgotado } = await admin
      .from("bonos_cliente")
      .insert({
        cliente_id: lauraClienteId,
        plan_id: planBonoId,
        tipo: "normal",
        creditos_totales: 1,
        creditos_usados: 1,
        fecha_compra: fechaCompra,
        fecha_caducidad: caducidadProxima.toISOString().slice(0, 10),
        activo: true,
      })
      .select()
      .single();
    if (errorBonoAgotado || !bonoAgotado) throw errorBonoAgotado ?? new Error("No se pudo crear el bono agotado");
    bonosCreados.push(bonoAgotado.id);

    const fixture = await crearClaseConSesion(admin, { offsetHoras: 48, aforoMax: 1 });
    clasesCreadas.push(fixture.claseId);

    const maria = await signInAs("maria@example.com");
    const { data: reservaMaria, error: errorMaria } = await maria.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: mariaClienteId,
    });
    expect(errorMaria).toBeNull();
    expect(reservaMaria?.estado).toBe("confirmada");

    const laura = await signInAs("laura@example.com");
    const { data: reservaLaura, error: errorLaura } = await laura.rpc("reservar_sesion", {
      p_sesion_id: fixture.sesionId,
      p_cliente_id: lauraClienteId,
    });
    expect(errorLaura).toBeNull();
    expect(reservaLaura?.estado).toBe("lista_espera");
    // Estar en lista de espera no cobra credito.
    const { data: bonoAntes } = await admin
      .from("bonos_cliente")
      .select("creditos_usados")
      .eq("id", bonoNormalLauraId)
      .single();
    expect(bonoAntes?.creditos_usados).toBe(0);

    const { error: errorCancelar } = await maria.rpc("cancelar_reserva", { p_reserva_id: reservaMaria!.id });
    expect(errorCancelar).toBeNull();

    const { data: lauraPromovida } = await admin
      .from("reservas")
      .select("estado")
      .eq("id", reservaLaura!.id)
      .single();
    expect(lauraPromovida?.estado).toBe("confirmada");

    // El credito sale del bono con saldo, no del agotado.
    const { data: bonoBueno } = await admin
      .from("bonos_cliente")
      .select("creditos_usados")
      .eq("id", bonoNormalLauraId)
      .single();
    expect(bonoBueno?.creditos_usados).toBe(1);

    const { data: bonoSinSaldo } = await admin
      .from("bonos_cliente")
      .select("creditos_usados")
      .eq("id", bonoAgotado.id)
      .single();
    expect(bonoSinSaldo?.creditos_usados).toBe(1);
  });
});
