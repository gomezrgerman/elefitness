import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { signInAs } from "./helpers";

describe("copiar_semana RPC", () => {
  const admin = createAdminClient();
  let claseId: string;
  let sesionOrigenId: string;
  let fechaOrigen: string;
  let fechaDestino: string;
  let mariaClienteId: string;

  beforeAll(async () => {
    const { data: usuario } = await admin.from("users").select("id").eq("email", "ivan@elefitness.com").single();
    const { data: clase } = await admin
      .from("clases")
      .insert({ dia: "sabado", hora_inicio: "09:00", hora_fin: "10:00", aforo_max: 5, entrenador_id: usuario!.id, recurrente: true })
      .select()
      .single();
    claseId = clase!.id;

    const base = new Date();
    base.setDate(base.getDate() + 2);
    fechaOrigen = base.toISOString().slice(0, 10);
    const destino = new Date(base);
    destino.setDate(destino.getDate() + 7);
    fechaDestino = destino.toISOString().slice(0, 10);

    const { data: sesion } = await admin.from("sesiones").insert({ clase_id: claseId, fecha: fechaOrigen }).select().single();
    sesionOrigenId = sesion!.id;

    const { data: usuarioMaria } = await admin.from("users").select("id").eq("email", "maria@example.com").single();
    const { data: clienteMaria } = await admin.from("clientes").select("id").eq("usuario_id", usuarioMaria!.id).single();
    mariaClienteId = clienteMaria!.id;
    await admin.from("reservas").insert({ sesion_id: sesionOrigenId, cliente_id: mariaClienteId, estado: "confirmada" });
  });

  afterAll(async () => {
    await admin.from("clases").delete().eq("id", claseId);
  });

  it("copia la sesion y la reserva confirmada a la semana destino", async () => {
    const elena = await signInAs("elena@elefitness.com");
    const { data, error } = await elena.rpc("copiar_semana", { p_fecha_origen: fechaOrigen, p_fecha_destino: fechaDestino });
    expect(error).toBeNull();
    expect(data).toBe(1);

    const { data: sesionDestino } = await admin.from("sesiones").select("id").eq("clase_id", claseId).eq("fecha", fechaDestino).single();
    expect(sesionDestino).not.toBeNull();

    const { data: reservaCopiada } = await admin
      .from("reservas")
      .select("estado")
      .eq("sesion_id", sesionDestino!.id)
      .eq("cliente_id", mariaClienteId)
      .single();
    expect(reservaCopiada?.estado).toBe("confirmada");
  });
});
