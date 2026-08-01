import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { signInAs } from "./helpers";

describe("reservar_clase / cancelar_reserva RPC", () => {
  const admin = createAdminClient();
  let claseMiercolesId: string;
  let saraClienteId: string;
  let anaClienteId: string;
  let lauraClienteId: string;
  let anaReservaId: string;
  let lauraReservaId: string;

  beforeAll(async () => {
    const { data: clase } = await admin.from("clases").select("id").eq("dia", "miercoles").single();
    claseMiercolesId = clase!.id;

    async function clienteIdPorEmail(email: string): Promise<string> {
      const { data: usuario } = await admin.from("users").select("id").eq("email", email).single();
      const { data: cliente } = await admin.from("clientes").select("id").eq("usuario_id", usuario!.id).single();
      return cliente!.id;
    }

    saraClienteId = await clienteIdPorEmail("sara@example.com");
    anaClienteId = await clienteIdPorEmail("ana@example.com");
    lauraClienteId = await clienteIdPorEmail("laura@example.com");

    const { data: anaReserva } = await admin
      .from("reservas")
      .select("id")
      .eq("clase_id", claseMiercolesId)
      .eq("cliente_id", anaClienteId)
      .single();
    anaReservaId = anaReserva!.id;

    const { data: lauraReserva } = await admin
      .from("reservas")
      .select("id")
      .eq("clase_id", claseMiercolesId)
      .eq("cliente_id", lauraClienteId)
      .single();
    lauraReservaId = lauraReserva!.id;
  });

  afterAll(async () => {
    await admin.from("reservas").delete().eq("clase_id", claseMiercolesId).eq("cliente_id", saraClienteId);
    await admin.from("reservas").update({ estado: "confirmada" }).eq("id", anaReservaId);
    await admin.from("reservas").update({ estado: "lista_espera" }).eq("id", lauraReservaId);
    await admin.from("bonos_cliente").update({ creditos_usados: 0 }).eq("cliente_id", lauraClienteId);
  });

  it("reservar_clase en una clase con aforo lleno devuelve lista_espera", async () => {
    const sara = await signInAs("sara@example.com");
    const { data, error } = await sara.rpc("reservar_clase", {
      p_clase_id: claseMiercolesId,
      p_cliente_id: saraClienteId,
    });
    expect(error).toBeNull();
    expect(data?.estado).toBe("lista_espera");
  });

  it("reservar con bono sin creditos restantes falla", async () => {
    await admin.from("bonos_cliente").update({ creditos_usados: 10 }).eq("cliente_id", lauraClienteId);

    const laura = await signInAs("laura@example.com");
    const { data: nuevaClase } = await admin.from("clases").select("id").eq("dia", "lunes").single();

    const { error } = await laura.rpc("reservar_clase", {
      p_clase_id: nuevaClase!.id,
      p_cliente_id: lauraClienteId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/creditos de bono/);

    await admin.from("bonos_cliente").update({ creditos_usados: 0 }).eq("cliente_id", lauraClienteId);
  });

  it("cancelar una reserva confirmada promueve la primera en lista_espera y cobra su credito de bono", async () => {
    const ana = await signInAs("ana@example.com");
    const { data, error } = await ana.rpc("cancelar_reserva", { p_reserva_id: anaReservaId });
    expect(error).toBeNull();
    expect(data?.estado).toBe("cancelada");

    const { data: lauraActualizada } = await admin.from("reservas").select("estado").eq("id", lauraReservaId).single();
    expect(lauraActualizada?.estado).toBe("confirmada");

    const { data: bonoLaura } = await admin.from("bonos_cliente").select("creditos_usados").eq("cliente_id", lauraClienteId).single();
    expect(bonoLaura?.creditos_usados).toBe(1);
  });

  it("cancelar la reserva promovida de Laura devuelve su credito de bono", async () => {
    const laura = await signInAs("laura@example.com");
    const { error } = await laura.rpc("cancelar_reserva", { p_reserva_id: lauraReservaId });
    expect(error).toBeNull();

    const { data: bonoLaura } = await admin.from("bonos_cliente").select("creditos_usados").eq("cliente_id", lauraClienteId).single();
    expect(bonoLaura?.creditos_usados).toBe(0);
  });
});
