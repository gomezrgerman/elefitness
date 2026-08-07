import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { signInAs } from "./helpers";

describe("marcar_asistencia RPC", () => {
  const admin = createAdminClient();
  let mariaReservaId: string;
  let mariaClienteId: string;

  beforeAll(async () => {
    const { data: usuario } = await admin.from("users").select("id").eq("email", "maria@example.com").single();
    const { data: cliente } = await admin.from("clientes").select("id").eq("usuario_id", usuario!.id).single();
    mariaClienteId = cliente!.id;

    const { data: reserva } = await admin.from("reservas").select("id").eq("cliente_id", mariaClienteId).eq("estado", "confirmada").single();
    mariaReservaId = reserva!.id;
  });

  afterAll(async () => {
    await admin.from("reservas").update({ asistencia: "pendiente" }).eq("id", mariaReservaId);
    await admin.from("clientes").update({ deuda_creditos: 0 }).eq("id", mariaClienteId);
  });

  it("un cliente no puede marcar asistencia", async () => {
    const sara = await signInAs("sara@example.com");
    const { error } = await sara.rpc("marcar_asistencia", { p_reserva_id: mariaReservaId, p_asistio: true });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/No autorizado/);
  });

  it("un entrenador si puede marcar asistencia (permiso confirmado en la propuesta comercial)", async () => {
    const ivan = await signInAs("ivan@elefitness.com");
    const { data, error } = await ivan.rpc("marcar_asistencia", { p_reserva_id: mariaReservaId, p_asistio: false });
    expect(error).toBeNull();
    expect(data?.asistencia).toBe("no_asistio");

    const { data: cliente } = await admin.from("clientes").select("deuda_creditos").eq("id", mariaClienteId).single();
    expect(cliente?.deuda_creditos).toBe(1);
  });
});
