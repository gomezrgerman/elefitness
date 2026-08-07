import { beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { signInAs } from "./helpers";

describe("Autorizacion de reservar_sesion / cancelar_reserva RPC", () => {
  const admin = createAdminClient();
  let sesionLunesId: string;
  let mariaClienteId: string;
  let lauraClienteId: string;
  let mariaReservaId: string;

  beforeAll(async () => {
    const { data: clase } = await admin.from("clases").select("id").eq("dia", "lunes").single();
    const { data: sesion } = await admin.from("sesiones").select("id").eq("clase_id", clase!.id).limit(1).single();
    sesionLunesId = sesion!.id;

    async function clienteIdPorEmail(email: string): Promise<string> {
      const { data: usuario } = await admin.from("users").select("id").eq("email", email).single();
      const { data: cliente } = await admin.from("clientes").select("id").eq("usuario_id", usuario!.id).single();
      return cliente!.id;
    }

    mariaClienteId = await clienteIdPorEmail("maria@example.com");
    lauraClienteId = await clienteIdPorEmail("laura@example.com");

    const { data: mariaReserva } = await admin
      .from("reservas")
      .select("id")
      .eq("sesion_id", sesionLunesId)
      .eq("cliente_id", mariaClienteId)
      .single();
    mariaReservaId = mariaReserva!.id;
  });

  it("una clienta no puede llamar a reservar_sesion con el cliente_id de otra clienta", async () => {
    const maria = await signInAs("maria@example.com");
    const { error } = await maria.rpc("reservar_sesion", {
      p_sesion_id: sesionLunesId,
      p_cliente_id: lauraClienteId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/No autorizado/);
  });

  it("una clienta no puede cancelar la reserva de otra clienta", async () => {
    const laura = await signInAs("laura@example.com");
    const { error } = await laura.rpc("cancelar_reserva", {
      p_reserva_id: mariaReservaId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/No autorizado/);
  });

  it("el entrenador no puede llamar a reservar_sesion en nombre de una clienta", async () => {
    const ivan = await signInAs("ivan@elefitness.com");
    const { error } = await ivan.rpc("reservar_sesion", {
      p_sesion_id: sesionLunesId,
      p_cliente_id: mariaClienteId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/No autorizado/);
  });

  it("el entrenador no puede cancelar la reserva de una clienta", async () => {
    const ivan = await signInAs("ivan@elefitness.com");
    const { error } = await ivan.rpc("cancelar_reserva", {
      p_reserva_id: mariaReservaId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/No autorizado/);
  });
});
