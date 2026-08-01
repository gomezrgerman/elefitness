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
    const { data: planMensual } = await admin.from("planes").select("id").eq("tipo", "mensual").single();
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
});
