import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { signInAs } from "./helpers";

describe("crear_bono RPC", () => {
  const admin = createAdminClient();
  let saraClienteId: string;
  let planBonoId: string;
  let bonoCreadoId: string | undefined;

  beforeAll(async () => {
    const { data: usuario } = await admin.from("users").select("id").eq("email", "sara@example.com").single();
    const { data: cliente } = await admin.from("clientes").select("id").eq("usuario_id", usuario!.id).single();
    saraClienteId = cliente!.id;

    const { data: plan } = await admin.from("planes").select("id").eq("tipo", "bono").single();
    planBonoId = plan!.id;
  });

  afterAll(async () => {
    if (bonoCreadoId) await admin.from("bonos_cliente").delete().eq("id", bonoCreadoId);
    await admin.from("clientes").update({ deuda_creditos: 0 }).eq("id", saraClienteId);
  });

  it("un cliente no puede crear bonos (admin-only)", async () => {
    const sara = await signInAs("sara@example.com");
    const { error } = await sara.rpc("crear_bono", {
      p_cliente_id: saraClienteId,
      p_plan_id: planBonoId,
      p_creditos_totales: 5,
      p_fecha_compra: new Date().toISOString().slice(0, 10),
      p_tipo: "normal",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/No autorizado/);
  });

  it("un entrenador no puede crear bonos (admin-only, distinto de marcar_asistencia)", async () => {
    const ivan = await signInAs("ivan@elefitness.com");
    const { error } = await ivan.rpc("crear_bono", {
      p_cliente_id: saraClienteId,
      p_plan_id: planBonoId,
      p_creditos_totales: 5,
      p_fecha_compra: new Date().toISOString().slice(0, 10),
      p_tipo: "normal",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/No autorizado/);
  });

  it("un bono normal caduca a los 3 meses de la fecha de compra", async () => {
    const elena = await signInAs("elena@elefitness.com");
    const fechaCompra = "2026-08-01";
    const { data, error } = await elena.rpc("crear_bono", {
      p_cliente_id: saraClienteId,
      p_plan_id: planBonoId,
      p_creditos_totales: 5,
      p_fecha_compra: fechaCompra,
      p_tipo: "normal",
    });
    expect(error).toBeNull();
    expect(data?.fecha_caducidad).toBe("2026-11-01");
    bonoCreadoId = data?.id;
  });

  it("crear_bono descuenta la deuda pendiente de los creditos nuevos", async () => {
    await admin.from("clientes").update({ deuda_creditos: 2 }).eq("id", saraClienteId);
    if (bonoCreadoId) await admin.from("bonos_cliente").delete().eq("id", bonoCreadoId);

    const elena = await signInAs("elena@elefitness.com");
    const { data, error } = await elena.rpc("crear_bono", {
      p_cliente_id: saraClienteId,
      p_plan_id: planBonoId,
      p_creditos_totales: 5,
      p_fecha_compra: "2026-08-01",
      p_tipo: "normal",
    });
    expect(error).toBeNull();
    expect(data?.creditos_totales).toBe(3);
    bonoCreadoId = data?.id;

    const { data: clienteActualizado } = await admin.from("clientes").select("deuda_creditos").eq("id", saraClienteId).single();
    expect(clienteActualizado?.deuda_creditos).toBe(0);
  });
});
