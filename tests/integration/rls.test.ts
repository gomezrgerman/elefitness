import { describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { signInAs } from "./helpers";

describe("RLS", () => {
  it("una clienta no puede leer las reservas de otra clienta", async () => {
    const admin = createAdminClient();
    const { data: usuarioLaura } = await admin.from("users").select("id").eq("email", "laura@example.com").single();
    const { data: clienteLaura } = await admin.from("clientes").select("id").eq("usuario_id", usuarioLaura!.id).single();

    const maria = await signInAs("maria@example.com");
    const { data } = await maria.from("reservas").select("*").eq("cliente_id", clienteLaura!.id);
    expect(data).toEqual([]);
  });

  it("una clienta no puede leer los pagos de otra clienta", async () => {
    const admin = createAdminClient();
    const { data: usuarioLaura } = await admin.from("users").select("id").eq("email", "laura@example.com").single();
    const { data: clienteLaura } = await admin.from("clientes").select("id").eq("usuario_id", usuarioLaura!.id).single();

    const maria = await signInAs("maria@example.com");
    const { data } = await maria.from("pagos").select("*").eq("cliente_id", clienteLaura!.id);
    expect(data).toEqual([]);
  });

  it("el entrenador no puede insertar clientes", async () => {
    const admin = createAdminClient();
    const { data: planMensual } = await admin.from("planes").select("id").eq("tipo", "mensual").limit(1).single();
    const { data: usuarioIvan } = await admin.from("users").select("id").eq("email", "ivan@elefitness.com").single();

    const ivan = await signInAs("ivan@elefitness.com");
    const { data: insertado, error } = await ivan
      .from("clientes")
      .insert({
        usuario_id: usuarioIvan!.id,
        plan_id: planMensual!.id,
        notas_rutina: "",
      })
      .select();

    if (insertado && insertado.length > 0) {
      await admin.from("clientes").delete().eq("usuario_id", usuarioIvan!.id);
    }

    expect(error).not.toBeNull();
  });

  it("el entrenador no puede actualizar reservas", async () => {
    const admin = createAdminClient();
    const { data: unaReserva } = await admin.from("reservas").select("id").limit(1).single();

    const ivan = await signInAs("ivan@elefitness.com");
    const { data } = await ivan.from("reservas").update({ estado: "cancelada" }).eq("id", unaReserva!.id).select();
    expect(data).toEqual([]);
  });

  // devolverCreditoSesion y anadirSesionExtraBono (lib/actions/bonos.ts) son
  // updates directos sobre bonos_cliente, sin RPC de por medio: la unica
  // frontera de autorizacion es bonos_admin_all. Estos dos tests cubren esa
  // frontera desde los dos lados.
  it("el entrenador no puede modificar los creditos de un bono", async () => {
    const admin = createAdminClient();
    const { data: usuarioLaura } = await admin.from("users").select("id").eq("email", "laura@example.com").single();
    const { data: clienteLaura } = await admin.from("clientes").select("id").eq("usuario_id", usuarioLaura!.id).single();
    const { data: bonoLaura } = await admin
      .from("bonos_cliente")
      .select("id, creditos_usados")
      .eq("cliente_id", clienteLaura!.id)
      .eq("tipo", "normal")
      .single();

    const ivan = await signInAs("ivan@elefitness.com");
    const { data } = await ivan
      .from("bonos_cliente")
      .update({ creditos_usados: bonoLaura!.creditos_usados + 1 })
      .eq("id", bonoLaura!.id)
      .select();
    expect(data).toEqual([]);
  });

  it("el admin puede devolver un credito o anadir una sesion extra a un bono", async () => {
    const admin = createAdminClient();
    const { data: usuarioLaura } = await admin.from("users").select("id").eq("email", "laura@example.com").single();
    const { data: clienteLaura } = await admin.from("clientes").select("id").eq("usuario_id", usuarioLaura!.id).single();
    const { data: bonoLaura } = await admin
      .from("bonos_cliente")
      .select("id, creditos_usados, creditos_totales")
      .eq("cliente_id", clienteLaura!.id)
      .eq("tipo", "normal")
      .single();
    const { creditos_usados: usadosOriginal, creditos_totales: totalesOriginal } = bonoLaura!;

    try {
      const elena = await signInAs("elena@elefitness.com");
      const { data: devuelto, error: errorDevolver } = await elena
        .from("bonos_cliente")
        .update({ creditos_usados: Math.max(0, usadosOriginal - 1) })
        .eq("id", bonoLaura!.id)
        .select();
      expect(errorDevolver).toBeNull();
      expect(devuelto?.[0]?.creditos_usados).toBe(Math.max(0, usadosOriginal - 1));

      const { data: ampliado, error: errorAnadir } = await elena
        .from("bonos_cliente")
        .update({ creditos_totales: totalesOriginal + 1 })
        .eq("id", bonoLaura!.id)
        .select();
      expect(errorAnadir).toBeNull();
      expect(ampliado?.[0]?.creditos_totales).toBe(totalesOriginal + 1);
    } finally {
      await admin
        .from("bonos_cliente")
        .update({ creditos_usados: usadosOriginal, creditos_totales: totalesOriginal })
        .eq("id", bonoLaura!.id);
    }
  });
});
