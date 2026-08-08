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
    // Belt-and-braces: si un expect() lanzo antes de poder capturar bonoCreadoId
    // (ver el fix de orden mas abajo), esto igualmente limpia cualquier bono
    // normal de Sara creado por este archivo durante la ejecucion.
    await admin.from("bonos_cliente").delete().eq("cliente_id", saraClienteId).eq("tipo", "normal");
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
    // Capturar el id antes de cualquier expect(): si la asercion de abajo
    // lanza, bonoCreadoId ya apunta a la fila real y afterAll puede borrarla
    // (en vez de quedar huerfana en el proyecto Supabase compartido).
    bonoCreadoId = data?.id;
    expect(error).toBeNull();
    expect(data?.fecha_caducidad).toBe("2026-11-01");
  });

  it("crear_bono descuenta la deuda pendiente de los creditos nuevos", async () => {
    await admin.from("clientes").update({ deuda_creditos: 2 }).eq("id", saraClienteId);
    if (bonoCreadoId) await admin.from("bonos_cliente").delete().eq("id", bonoCreadoId);
    bonoCreadoId = undefined;

    const elena = await signInAs("elena@elefitness.com");
    const { data, error } = await elena.rpc("crear_bono", {
      p_cliente_id: saraClienteId,
      p_plan_id: planBonoId,
      p_creditos_totales: 5,
      p_fecha_compra: "2026-08-01",
      p_tipo: "normal",
    });
    // Misma razon que arriba: capturar antes de los expect() que pueden lanzar.
    bonoCreadoId = data?.id;
    expect(error).toBeNull();
    expect(data?.creditos_totales).toBe(3);

    const { data: clienteActualizado } = await admin.from("clientes").select("deuda_creditos").eq("id", saraClienteId).single();
    expect(clienteActualizado?.deuda_creditos).toBe(0);
  });
});
