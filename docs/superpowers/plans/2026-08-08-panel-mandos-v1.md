# Panel de mandos v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a Elena e Iván las pantallas para operar el día a día — calendario con vistas día/semana/mes, pasar lista, ficha de clienta con historial — y quitar de la vista de la clienta lo que Elena pidió ocultar.

**Architecture:** Una sola pantalla de calendario compartida por ambos roles, con el estado de vista y fecha en el cliente. La vista de día es la única que muestra nombres, así que es donde viven las acciones (asistencia, quitar de clase). La lógica de fechas se extrae a `lib/fechas.ts` como funciones puras para no duplicar aritmética de calendario en tres componentes. La única lógica de negocio nueva vive en una migración (`0012`), que hace la asistencia reversible.

**Tech Stack:** Next.js 15 (App Router, Server Components + Server Actions), Supabase Postgres (RLS + RPCs `security definer`), Tailwind, shadcn/ui, Vitest (tests de integración contra el proyecto Supabase real).

**Diseño de referencia:** `docs/superpowers/specs/2026-08-08-panel-mandos-v1-design.md`

## Global Constraints

- Toda RPC nueva o redefinida es `security definer`, con `set search_path = public`, `revoke all ... from public`, `grant execute ... to authenticated` — igual que las existentes.
- SQL nuevo va siempre en una migración nueva, nunca editando una ya aplicada. Se aplica con:
  `npx supabase db push --db-url 'postgresql://postgres.pdvpruktssojuicwhhlt:El11deldenia!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' --yes`
  (`supabase link` tiene un bug de CLI y la conexión directa no resuelve en este entorno; el pooler sí.)
- Server actions: `"use server"`, retorno `Promise<{ error?: string }>`, `revalidatePath` de cada panel afectado.
- Nombres en español, snake_case en Postgres y camelCase en `lib/types.ts`; `lib/supabase/queries.ts` hace el mapeo.
- Los tests de integración corren contra el proyecto Supabase real, en secuencia (`fileParallelism: false`), sobre los datos de `scripts/seed.ts`. Cada test limpia lo que crea. Helpers en `tests/integration/helpers.ts`: `signInAs`, `crearClaseConSesion`, `borrarClases`, `clienteIdPorEmail`, `instanteUtc`.
- **Fuera de alcance, no construir:** crear/editar/borrar clases y sesiones, botón de copiar semana, registrar bonos, ajustar aforo de una sesión, compensar créditos, blindar el aforo a nivel de API, Stripe/emails/PWA/landing. Dependen de una conversación pendiente con la clienta.
- No hay tests de componentes en el proyecto y no se monta esa infraestructura aquí: las pantallas se verifican a mano con las cuentas demo (`/login` tiene acceso rápido).

---

## File Structure

```
supabase/migrations/
  0012_marcar_asistencia_reversible.sql   (nuevo)

lib/
  database.types.ts                       (regenerado)
  types.ts                                (+ MovimientoHistorial)
  fechas.ts                               (nuevo — aritmética de calendario, pura)
  actions/asistencia.ts                   (firma nueva)
  supabase/queries.ts                     (+ obtenerHistorialDeCliente)

components/calendario/
  calendario-clases.tsx                   (nuevo — estado de vista y fecha)
  selector-vista.tsx                      (nuevo — Día/Semana/Mes + navegación)
  vista-dia.tsx                           (nuevo — nombres, asistencia, quitar)
  vista-semana.tsx                        (nuevo — compacta)
  vista-mes.tsx                           (nuevo — rejilla con carga)
components/
  calendario-semanal.tsx                  (se elimina)
  ficha-cliente.tsx                       (nuevo)
  lista-clientes.tsx                      (+ enlace a la ficha)
  horario-cliente.tsx                     (libre/completo, ventana, fecha)

app/
  admin/clases/page.tsx                   (usa el calendario nuevo)
  entrenador/clases/page.tsx              (idem, sin quitar)
  admin/clientes/[id]/page.tsx            (nuevo)
  entrenador/clientes/[id]/page.tsx       (nuevo)
  admin/clientes/page.tsx                 (pasa basePath)
  entrenador/clientes/page.tsx            (pasa basePath)
  cliente/page.tsx                        (libre/completo en servidor)

tests/integration/
  rpc-asistencia.test.ts                  (reescrito)
  rpc-cancelacion.test.ts                 (un test adaptado)
```

---

### Task 1: Migración 0012 — asistencia reversible

**Files:**
- Create: `supabase/migrations/0012_marcar_asistencia_reversible.sql`

**Interfaces:**
- Produces: `marcar_asistencia(p_reserva_id uuid, p_asistencia estado_asistencia_enum) returns reservas` (reemplaza la versión `boolean`), y `registrar_historial_reserva()` redefinida para anotar también las correcciones.

- [ ] **Step 1: Escribir la migración**

```sql
-- 0012_marcar_asistencia_reversible.sql
-- marcar_asistencia solo iba hacia adelante: sin vuelta a 'pendiente'. Como
-- cancelar_reserva rechaza cancelar una reserva con la asistencia registrada,
-- un clic mal dado dejaba la reserva atrapada de forma permanente, sin salida
-- ni para la clienta ni para Elena.
--
-- Cambia a tres estados (el enum ya existe), ajusta la deuda por transicion en
-- vez de solo sumar, y anade la guarda que faltaba: no se marca la asistencia
-- de una clase que todavia no ha empezado.
--
-- El trigger de historial pasa a anotar tambien las correcciones: sin esto, una
-- falta desmarcada seguiria apareciendo como falta en la ficha de la clienta.

drop function if exists public.marcar_asistencia(uuid, boolean);

create or replace function public.marcar_asistencia(
  p_reserva_id uuid,
  p_asistencia estado_asistencia_enum
)
returns public.reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserva public.reservas;
  v_sesion public.sesiones;
  v_clase public.clases;
  v_delta integer;
begin
  if public.auth_rol() not in ('admin', 'entrenador') then
    raise exception 'No autorizado para marcar asistencia';
  end if;

  select * into v_reserva from public.reservas where id = p_reserva_id for update;
  if not found then
    raise exception 'Reserva no encontrada';
  end if;

  if v_reserva.estado <> 'confirmada' then
    raise exception 'Solo se puede marcar asistencia de una reserva confirmada';
  end if;

  select * into v_sesion from public.sesiones where id = v_reserva.sesion_id;
  select * into v_clase from public.clases where id = v_sesion.clase_id;

  if (v_sesion.fecha + v_clase.hora_inicio) > now() then
    raise exception 'Esta clase todavia no ha empezado';
  end if;

  -- Sin cambio real no se toca nada: evita anotar un movimiento de historial
  -- por pulsar dos veces el estado que ya estaba.
  if v_reserva.asistencia = p_asistencia then
    return v_reserva;
  end if;

  v_delta := (case when p_asistencia = 'no_asistio' then 1 else 0 end)
           - (case when v_reserva.asistencia = 'no_asistio' then 1 else 0 end);

  update public.reservas
    set asistencia = p_asistencia
    where id = p_reserva_id
    returning * into v_reserva;

  if v_delta <> 0 then
    update public.clientes
      set deuda_creditos = greatest(0, deuda_creditos + v_delta)
      where id = v_reserva.cliente_id;
  end if;

  return v_reserva;
end;
$$;

revoke all on function public.marcar_asistencia(uuid, estado_asistencia_enum) from public;
grant execute on function public.marcar_asistencia(uuid, estado_asistencia_enum) to authenticated;

create or replace function public.registrar_historial_reserva()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.reservas_historial (reserva_id, sesion_id, cliente_id, evento)
    values (new.id, new.sesion_id, new.cliente_id, case when new.estado = 'lista_espera' then 'en_lista_espera' else 'apuntado' end);
    return new;
  end if;

  if new.estado <> old.estado then
    if new.estado = 'cancelada' then
      insert into public.reservas_historial (reserva_id, sesion_id, cliente_id, evento)
      values (new.id, new.sesion_id, new.cliente_id, 'desapuntado');
    elsif new.estado = 'confirmada' and old.estado = 'lista_espera' then
      insert into public.reservas_historial (reserva_id, sesion_id, cliente_id, evento)
      values (new.id, new.sesion_id, new.cliente_id, 'promovido_desde_lista_espera');
    end if;
  end if;

  if new.asistencia <> old.asistencia then
    if new.asistencia = 'pendiente' then
      insert into public.reservas_historial (reserva_id, sesion_id, cliente_id, evento)
      values (new.id, new.sesion_id, new.cliente_id, 'asistencia_corregida');
    else
      insert into public.reservas_historial (reserva_id, sesion_id, cliente_id, evento)
      values (new.id, new.sesion_id, new.cliente_id, new.asistencia::text);
    end if;
  end if;

  return new;
end;
$$;
```

- [ ] **Step 2: Aplicar la migración**

Run: `npx supabase db push --db-url 'postgresql://postgres.pdvpruktssojuicwhhlt:El11deldenia!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' --yes`
Expected: aplica `0012_marcar_asistencia_reversible.sql` sin errores.

- [ ] **Step 3: Comprobar que la firma vieja ya no existe**

Run: `npx supabase db push --db-url '...' --dry-run` (misma cadena)
Expected: `"upToDate":true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0012_marcar_asistencia_reversible.sql
git commit -m "feat: asistencia reversible con ajuste de deuda por transicion"
```

---

### Task 2: Regenerar tipos y actualizar la acción de asistencia

**Files:**
- Modify: `lib/database.types.ts` (regenerado, no editar a mano)
- Modify: `lib/actions/asistencia.ts`

**Interfaces:**
- Consumes: la firma nueva de Task 1.
- Produces: `marcarAsistencia(reservaId: string, asistencia: EstadoAsistencia): Promise<{ error?: string }>`.

- [ ] **Step 1: Regenerar los tipos**

Run: `npx supabase gen types typescript --project-id pdvpruktssojuicwhhlt --schema public > lib/database.types.ts`
Expected: `marcar_asistencia` pasa a tener `Args: { p_reserva_id: string; p_asistencia: ... }`.

- [ ] **Step 2: Reemplazar `lib/actions/asistencia.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { EstadoAsistencia } from "@/lib/types";

export async function marcarAsistencia(
  reservaId: string,
  asistencia: EstadoAsistencia
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_asistencia", {
    p_reserva_id: reservaId,
    p_asistencia: asistencia,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/clases");
  revalidatePath("/entrenador/clases");
  revalidatePath("/admin/clientes");
  revalidatePath("/entrenador/clientes");
  return {};
}
```

- [ ] **Step 3: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores (ningún componente llama todavía a `marcarAsistencia`).

- [ ] **Step 4: Commit**

```bash
git add lib/database.types.ts lib/actions/asistencia.ts
git commit -m "feat: marcarAsistencia acepta los tres estados de asistencia"
```

---

### Task 3: Tests de la asistencia reversible

**Files:**
- Modify: `tests/integration/rpc-asistencia.test.ts` (reescrito completo)
- Modify: `tests/integration/rpc-cancelacion.test.ts` (un test adaptado)

**Interfaces:**
- Consumes: `marcar_asistencia(uuid, estado_asistencia_enum)` de Task 1; helpers de `tests/integration/helpers.ts`.

- [ ] **Step 1: Reemplazar `tests/integration/rpc-asistencia.test.ts`**

```ts
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
```

- [ ] **Step 2: Adaptar el test de cancelación bloqueada por asistencia**

En `tests/integration/rpc-cancelacion.test.ts`, el test que comprueba que no se puede cancelar una reserva con la asistencia registrada montaba el escenario llamando a `marcar_asistencia`. Con la guarda de fecha nueva eso ya no es posible: la asistencia solo se marca una vez la clase ha empezado, y una clase empezada tampoco se puede cancelar (esa guarda salta antes).

Cambiar ese test para que prepare el estado directamente con el cliente admin, de modo que siga verificando que la guarda existe:

```ts
  it("no se puede cancelar una reserva con la asistencia ya registrada", async () => {
    // La asistencia solo se puede marcar sobre una clase ya empezada, y esa
    // tampoco se puede cancelar. Se prepara el estado a mano para comprobar la
    // guarda en aislamiento.
    await admin.from("reservas").update({ asistencia: "asistio" }).eq("id", reservaConAsistenciaId);

    const maria = await signInAs("maria@example.com");
    const { error } = await maria.rpc("cancelar_reserva", { p_reserva_id: reservaConAsistenciaId });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/asistencia ya registrada/);

    await admin.from("reservas").update({ asistencia: "pendiente" }).eq("id", reservaConAsistenciaId);
  });
```

Adaptar los nombres de variable a los que ya use el fichero. Si el fichero llamaba a `marcar_asistencia` con `p_asistio`, esa llamada desaparece.

- [ ] **Step 3: Correr la suite completa**

Run: `npm run test:integration`
Expected: todos los tests pasan, salida limpia.

- [ ] **Step 4: Correrla una segunda vez**

Run: `npm run test:integration`
Expected: verde igual — confirma que los tests limpian su estado y no dependen del orden.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/
git commit -m "test: cubrir la asistencia reversible y su guarda de fecha"
```

---

### Task 4: `lib/fechas.ts` — aritmética de calendario

**Files:**
- Create: `lib/fechas.ts`

**Interfaces:**
- Produces: `sumarDias`, `inicioDeSemana`, `diasDeSemana`, `diasDeMes`, `mismoMes`, `formatearDiaCorto`, `formatearDiaLargo`, `formatearMes`, `ETIQUETA_DIA`. Todas operan sobre cadenas `YYYY-MM-DD`.

- [ ] **Step 1: Crear el archivo**

```ts
// Toda la aritmetica de calendario opera sobre cadenas YYYY-MM-DD y construye
// las fechas al mediodia UTC. Asi ningun cambio de hora ni diferencia de zona
// puede desplazar el dia, que es el error clasico al hacer esto con Date.

const ETIQUETAS_DIA = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
const ETIQUETAS_DIA_CORTO = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const ETIQUETAS_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function aDate(fecha: string): Date {
  return new Date(`${fecha}T12:00:00Z`);
}

function aCadena(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  const d = aDate(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return aCadena(d);
}

export function sumarMeses(fecha: string, meses: number): string {
  const d = aDate(fecha);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  return aCadena(d);
}

// La semana empieza en lunes.
export function inicioDeSemana(fecha: string): string {
  const d = aDate(fecha);
  const desplazamiento = (d.getUTCDay() + 6) % 7;
  return sumarDias(fecha, -desplazamiento);
}

export function diasDeSemana(fecha: string): string[] {
  const lunes = inicioDeSemana(fecha);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

export function diasDeMes(fecha: string): string[] {
  const d = aDate(fecha);
  const anyo = d.getUTCFullYear();
  const mes = d.getUTCMonth();
  const total = new Date(Date.UTC(anyo, mes + 1, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => aCadena(new Date(Date.UTC(anyo, mes, i + 1, 12))));
}

// Huecos vacios antes del dia 1 para que la rejilla del mes empiece en lunes.
export function huecosIniciales(fecha: string): number {
  const primero = diasDeMes(fecha)[0];
  return (aDate(primero).getUTCDay() + 6) % 7;
}

export function mismoMes(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function numeroDeDia(fecha: string): number {
  return aDate(fecha).getUTCDate();
}

export function formatearDiaCorto(fecha: string): string {
  return ETIQUETAS_DIA_CORTO[aDate(fecha).getUTCDay()];
}

export function formatearDiaLargo(fecha: string): string {
  const d = aDate(fecha);
  return `${ETIQUETAS_DIA[d.getUTCDay()]} ${d.getUTCDate()} de ${ETIQUETAS_MES[d.getUTCMonth()]}`;
}

export function formatearMes(fecha: string): string {
  const d = aDate(fecha);
  return `${ETIQUETAS_MES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatearRangoSemana(fecha: string): string {
  const dias = diasDeSemana(fecha);
  const primero = aDate(dias[0]);
  const ultimo = aDate(dias[6]);
  return `${primero.getUTCDate()} ${ETIQUETAS_MES[primero.getUTCMonth()]} – ${ultimo.getUTCDate()} ${ETIQUETAS_MES[ultimo.getUTCMonth()]}`;
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/fechas.ts
git commit -m "feat: helpers de calendario en UTC para las vistas de horario"
```

---

### Task 5: Historial de clienta en la capa de datos

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/supabase/queries.ts`

**Interfaces:**
- Produces: `MovimientoHistorial` en `lib/types.ts`, y `obtenerHistorialDeCliente(clienteId: string): Promise<MovimientoHistorial[]>`.

Nota: `reservas_historial.sesion_id` no tiene clave foránea a `sesiones` (está desnormalizado a propósito), así que PostgREST no puede hacer el join anidado. Se devuelven las filas planas y el componente las cruza con las sesiones y clases que ya recibe.

- [ ] **Step 1: Añadir el tipo al final de `lib/types.ts`**

```ts
export interface MovimientoHistorial {
  id: string;
  reservaId: string;
  sesionId: string;
  clienteId: string;
  evento: string;
  creadoEn: string;
}
```

- [ ] **Step 2: Añadir la consulta al final de `lib/supabase/queries.ts`**

Añadir `MovimientoHistorial` al `import type` de la cabecera del archivo, y al final:

```ts
export async function obtenerHistorialDeCliente(clienteId: string): Promise<MovimientoHistorial[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservas_historial")
    .select("id, reserva_id, sesion_id, cliente_id, evento, creado_en")
    .eq("cliente_id", clienteId)
    .order("creado_en", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    reservaId: m.reserva_id,
    sesionId: m.sesion_id,
    clienteId: m.cliente_id,
    evento: m.evento,
    creadoEn: m.creado_en,
  }));
}
```

- [ ] **Step 3: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/supabase/queries.ts
git commit -m "feat: consultar el historial de movimientos de una clienta"
```

---

### Task 6: Vista de día con asistencia y quitar de clase

**Files:**
- Create: `components/calendario/vista-dia.tsx`

**Interfaces:**
- Consumes: `marcarAsistencia` (Task 2), `cancelarReserva` de `lib/actions/reservas`, selectores existentes.
- Produces: `<VistaDia fecha ahora clases sesiones reservas clientes usuarios planes puedeQuitar />`.

- [ ] **Step 1: Crear el archivo**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BadgeEstado } from "@/components/badge-estado";
import {
  reservasConfirmadasDeSesion,
  reservasListaEsperaDeSesion,
  usuarioPorId,
  clientePorId,
  planPorId,
} from "@/lib/selectors";
import { marcarAsistencia } from "@/lib/actions/asistencia";
import { cancelarReserva } from "@/lib/actions/reservas";
import { formatearDiaLargo } from "@/lib/fechas";
import type { Clase, Sesion, Reserva, Cliente, Usuario, Plan, EstadoAsistencia } from "@/lib/types";

interface Props {
  fecha: string;
  ahora: string;
  clases: Clase[];
  sesiones: Sesion[];
  reservas: Reserva[];
  clientes: Cliente[];
  usuarios: Usuario[];
  planes: Plan[];
  puedeQuitar: boolean;
}

const ESTADOS: { valor: EstadoAsistencia; etiqueta: string }[] = [
  { valor: "asistio", etiqueta: "Vino" },
  { valor: "no_asistio", etiqueta: "Falto" },
  { valor: "pendiente", etiqueta: "Sin marcar" },
];

export function VistaDia({
  fecha,
  ahora,
  clases,
  sesiones,
  reservas,
  clientes,
  usuarios,
  planes,
  puedeQuitar,
}: Props) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState<string | null>(null);

  const sesionesDelDia = sesiones
    .filter((s) => s.fecha === fecha)
    .map((s) => ({ sesion: s, clase: clases.find((c) => c.id === s.claseId) }))
    .filter((x): x is { sesion: Sesion; clase: Clase } => Boolean(x.clase))
    .sort((a, b) => a.clase.horaInicio.localeCompare(b.clase.horaInicio));

  function cambiarAsistencia(reservaId: string, asistencia: EstadoAsistencia) {
    setError(null);
    startTransition(async () => {
      const respuesta = await marcarAsistencia(reservaId, asistencia);
      if (respuesta.error) setError(respuesta.error);
    });
  }

  function quitar(reservaId: string) {
    setError(null);
    setConfirmandoQuitar(null);
    startTransition(async () => {
      const respuesta = await cancelarReserva(reservaId);
      if (respuesta.error) setError(respuesta.error);
    });
  }

  if (sesionesDelDia.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="font-medium">{formatearDiaLargo(fecha)}</h3>
        <p className="text-sm text-muted-foreground">No hay clases este dia.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-medium">{formatearDiaLargo(fecha)}</h3>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {sesionesDelDia.map(({ sesion, clase }) => {
        const confirmadas = reservasConfirmadasDeSesion(reservas, sesion.id);
        const enEspera = reservasListaEsperaDeSesion(reservas, sesion.id);
        const aforo = sesion.aforoEfectivo ?? clase.aforoMax;
        const entrenador = usuarioPorId(usuarios, clase.entrenadorId);
        const inicio = new Date(`${sesion.fecha}T${clase.horaInicio}:00Z`);
        const yaEmpezo = inicio.getTime() <= new Date(ahora).getTime();
        const faltanMenosDe24h = inicio.getTime() - new Date(ahora).getTime() < 24 * 3600 * 1000;

        return (
          <Card key={sesion.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {clase.horaInicio} - {clase.horaFin}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {entrenador?.nombre ?? "—"} · {confirmadas.length}/{aforo} plazas
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {confirmadas.length === 0 && enEspera.length === 0 && (
                <p className="text-muted-foreground">Sin reservas todavia</p>
              )}

              {confirmadas.map((reserva) => {
                const cliente = clientePorId(clientes, reserva.clienteId);
                const usuario = cliente ? usuarioPorId(usuarios, cliente.usuarioId) : undefined;
                const plan = cliente ? planPorId(planes, cliente.planId) : undefined;
                const pierdeCredito = plan?.tipo === "bono" && faltanMenosDe24h;

                return (
                  <div key={reserva.id} className="flex flex-col gap-2 border-b pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{usuario?.nombre ?? "—"}</span>
                      {puedeQuitar && confirmandoQuitar !== reserva.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pendiente}
                          onClick={() => setConfirmandoQuitar(reserva.id)}
                        >
                          Quitar
                        </Button>
                      )}
                    </div>

                    {puedeQuitar && confirmandoQuitar === reserva.id && (
                      <div className="flex flex-col gap-2 rounded-md bg-muted p-2">
                        <p className="text-xs">
                          {pierdeCredito
                            ? "Quedan menos de 24h: al quitarla perdera el credito de esta clase."
                            : "Se le libera la plaza y entrara quien este primero en la lista de espera."}
                        </p>
                        <div className="flex gap-2">
                          <Button variant="destructive" size="sm" disabled={pendiente} onClick={() => quitar(reserva.id)}>
                            Confirmar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setConfirmandoQuitar(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {ESTADOS.map(({ valor, etiqueta }) => (
                        <Button
                          key={valor}
                          size="sm"
                          variant={reserva.asistencia === valor ? "default" : "outline"}
                          disabled={pendiente || !yaEmpezo}
                          onClick={() => cambiarAsistencia(reserva.id, valor)}
                        >
                          {etiqueta}
                        </Button>
                      ))}
                    </div>
                    {!yaEmpezo && <p className="text-xs text-muted-foreground">La clase aun no ha empezado.</p>}
                  </div>
                );
              })}

              {enEspera.map((reserva) => {
                const cliente = clientePorId(clientes, reserva.clienteId);
                const usuario = cliente ? usuarioPorId(usuarios, cliente.usuarioId) : undefined;
                return (
                  <div key={reserva.id} className="flex items-center justify-between">
                    <span>{usuario?.nombre ?? "—"}</span>
                    <BadgeEstado estado={reserva.estado} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/calendario/vista-dia.tsx
git commit -m "feat: vista de dia con pasar lista y quitar de clase"
```

---

### Task 7: Vistas de semana y mes

**Files:**
- Create: `components/calendario/vista-semana.tsx`
- Create: `components/calendario/vista-mes.tsx`

**Interfaces:**
- Consumes: `lib/fechas.ts` (Task 4), selectores existentes.
- Produces: `<VistaSemana fecha clases sesiones reservas onIrADia />`, `<VistaMes fecha clases sesiones reservas onIrADia />`. Ambas reciben `onIrADia(fecha: string)` para que pulsar un día lleve a la vista de día.

- [ ] **Step 1: Crear `components/calendario/vista-semana.tsx`**

```tsx
"use client";

import { reservasConfirmadasDeSesion } from "@/lib/selectors";
import { diasDeSemana, formatearDiaCorto, numeroDeDia } from "@/lib/fechas";
import type { Clase, Sesion, Reserva } from "@/lib/types";

interface Props {
  fecha: string;
  hoy: string;
  clases: Clase[];
  sesiones: Sesion[];
  reservas: Reserva[];
  onIrADia: (fecha: string) => void;
}

export function VistaSemana({ fecha, hoy, clases, sesiones, reservas, onIrADia }: Props) {
  const dias = diasDeSemana(fecha);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {dias.map((dia) => {
        const delDia = sesiones
          .filter((s) => s.fecha === dia)
          .map((s) => ({ sesion: s, clase: clases.find((c) => c.id === s.claseId) }))
          .filter((x): x is { sesion: Sesion; clase: Clase } => Boolean(x.clase))
          .sort((a, b) => a.clase.horaInicio.localeCompare(b.clase.horaInicio));

        return (
          <button
            key={dia}
            type="button"
            onClick={() => onIrADia(dia)}
            className={`flex flex-col gap-2 rounded-md border p-3 text-left transition hover:bg-muted ${
              dia === hoy ? "border-primary" : ""
            }`}
          >
            <span className="text-xs font-medium text-muted-foreground">
              {formatearDiaCorto(dia)} {numeroDeDia(dia)}
            </span>
            {delDia.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
            {delDia.map(({ sesion, clase }) => {
              const aforo = sesion.aforoEfectivo ?? clase.aforoMax;
              const confirmadas = reservasConfirmadasDeSesion(reservas, sesion.id).length;
              return (
                <span key={sesion.id} className="flex items-center justify-between text-sm">
                  <span>{clase.horaInicio}</span>
                  <span className="text-muted-foreground">
                    {confirmadas}/{aforo}
                  </span>
                </span>
              );
            })}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Crear `components/calendario/vista-mes.tsx`**

```tsx
"use client";

import { reservasConfirmadasDeSesion } from "@/lib/selectors";
import { diasDeMes, huecosIniciales, numeroDeDia } from "@/lib/fechas";
import type { Clase, Sesion, Reserva } from "@/lib/types";

interface Props {
  fecha: string;
  hoy: string;
  clases: Clase[];
  sesiones: Sesion[];
  reservas: Reserva[];
  onIrADia: (fecha: string) => void;
}

const CABECERAS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

// La carga es la ocupacion del dia sobre el aforo total de sus clases. Sirve
// para ver de un vistazo que dias flojean.
function colorDeCarga(apuntados: number, aforo: number): string {
  if (aforo === 0) return "";
  const ratio = apuntados / aforo;
  if (ratio >= 0.85) return "bg-emerald-600/20";
  if (ratio >= 0.4) return "bg-amber-500/20";
  return "bg-red-500/15";
}

export function VistaMes({ fecha, hoy, clases, sesiones, reservas, onIrADia }: Props) {
  const dias = diasDeMes(fecha);
  const huecos = huecosIniciales(fecha);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {CABECERAS.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: huecos }, (_, i) => (
          <span key={`hueco-${i}`} />
        ))}
        {dias.map((dia) => {
          const delDia = sesiones
            .filter((s) => s.fecha === dia)
            .map((s) => ({ sesion: s, clase: clases.find((c) => c.id === s.claseId) }))
            .filter((x): x is { sesion: Sesion; clase: Clase } => Boolean(x.clase));

          const apuntados = delDia.reduce((total, { sesion }) => total + reservasConfirmadasDeSesion(reservas, sesion.id).length, 0);
          const aforo = delDia.reduce((total, { sesion, clase }) => total + (sesion.aforoEfectivo ?? clase.aforoMax), 0);

          return (
            <button
              key={dia}
              type="button"
              onClick={() => onIrADia(dia)}
              className={`flex aspect-square flex-col items-center justify-center rounded-md border text-sm transition hover:bg-muted ${colorDeCarga(
                apuntados,
                aforo
              )} ${dia === hoy ? "border-primary" : ""}`}
            >
              <span className={delDia.length === 0 ? "text-muted-foreground" : "font-medium"}>{numeroDeDia(dia)}</span>
              {delDia.length > 0 && <span className="text-xs text-muted-foreground">{apuntados}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/calendario/vista-semana.tsx components/calendario/vista-mes.tsx
git commit -m "feat: vistas de semana y mes del calendario"
```

---

### Task 8: Ensamblar el calendario y conectarlo a las páginas

**Files:**
- Create: `components/calendario/selector-vista.tsx`
- Create: `components/calendario/calendario-clases.tsx`
- Modify: `app/admin/clases/page.tsx`
- Modify: `app/entrenador/clases/page.tsx`
- Delete: `components/calendario-semanal.tsx`

**Interfaces:**
- Consumes: `VistaDia` (Task 6), `VistaSemana`/`VistaMes` (Task 7), `lib/fechas.ts` (Task 4).
- Produces: `<CalendarioClases hoy ahora clases sesiones reservas clientes usuarios planes puedeQuitar />`.

- [ ] **Step 1: Crear `components/calendario/selector-vista.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/button";

export type Vista = "dia" | "semana" | "mes";

interface Props {
  vista: Vista;
  titulo: string;
  onCambiarVista: (vista: Vista) => void;
  onAnterior: () => void;
  onSiguiente: () => void;
  onHoy: () => void;
}

const OPCIONES: { valor: Vista; etiqueta: string }[] = [
  { valor: "dia", etiqueta: "Dia" },
  { valor: "semana", etiqueta: "Semana" },
  { valor: "mes", etiqueta: "Mes" },
];

export function SelectorVista({ vista, titulo, onCambiarVista, onAnterior, onSiguiente, onHoy }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onAnterior} aria-label="Anterior">
          ←
        </Button>
        <Button variant="outline" size="sm" onClick={onSiguiente} aria-label="Siguiente">
          →
        </Button>
        <Button variant="ghost" size="sm" onClick={onHoy}>
          Hoy
        </Button>
        <span className="text-sm font-medium">{titulo}</span>
      </div>
      <div className="flex gap-1">
        {OPCIONES.map(({ valor, etiqueta }) => (
          <Button
            key={valor}
            size="sm"
            variant={vista === valor ? "default" : "outline"}
            onClick={() => onCambiarVista(valor)}
          >
            {etiqueta}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear `components/calendario/calendario-clases.tsx`**

```tsx
"use client";

import { useState } from "react";
import { SelectorVista, type Vista } from "./selector-vista";
import { VistaDia } from "./vista-dia";
import { VistaSemana } from "./vista-semana";
import { VistaMes } from "./vista-mes";
import { formatearDiaLargo, formatearMes, formatearRangoSemana, sumarDias, sumarMeses } from "@/lib/fechas";
import type { Clase, Sesion, Reserva, Cliente, Usuario, Plan } from "@/lib/types";

interface Props {
  hoy: string;
  ahora: string;
  clases: Clase[];
  sesiones: Sesion[];
  reservas: Reserva[];
  clientes: Cliente[];
  usuarios: Usuario[];
  planes: Plan[];
  puedeQuitar: boolean;
}

export function CalendarioClases({
  hoy,
  ahora,
  clases,
  sesiones,
  reservas,
  clientes,
  usuarios,
  planes,
  puedeQuitar,
}: Props) {
  const [vista, setVista] = useState<Vista>("dia");
  const [fecha, setFecha] = useState(hoy);

  const titulo =
    vista === "dia" ? formatearDiaLargo(fecha) : vista === "semana" ? formatearRangoSemana(fecha) : formatearMes(fecha);

  function mover(direccion: 1 | -1) {
    if (vista === "dia") setFecha(sumarDias(fecha, direccion));
    else if (vista === "semana") setFecha(sumarDias(fecha, 7 * direccion));
    else setFecha(sumarMeses(fecha, direccion));
  }

  function irADia(nueva: string) {
    setFecha(nueva);
    setVista("dia");
  }

  return (
    <div className="flex flex-col gap-4">
      <SelectorVista
        vista={vista}
        titulo={titulo}
        onCambiarVista={setVista}
        onAnterior={() => mover(-1)}
        onSiguiente={() => mover(1)}
        onHoy={() => setFecha(hoy)}
      />

      {vista === "dia" && (
        <VistaDia
          fecha={fecha}
          ahora={ahora}
          clases={clases}
          sesiones={sesiones}
          reservas={reservas}
          clientes={clientes}
          usuarios={usuarios}
          planes={planes}
          puedeQuitar={puedeQuitar}
        />
      )}
      {vista === "semana" && (
        <VistaSemana fecha={fecha} hoy={hoy} clases={clases} sesiones={sesiones} reservas={reservas} onIrADia={irADia} />
      )}
      {vista === "mes" && (
        <VistaMes fecha={fecha} hoy={hoy} clases={clases} sesiones={sesiones} reservas={reservas} onIrADia={irADia} />
      )}
    </div>
  );
}
```

Nota: el título lo calcula también `SelectorVista` a través de la prop `titulo`; `VistaDia` repite el encabezado del día porque también se usa como cabecera de su propia lista. Es intencionado y no molesta.

- [ ] **Step 3: Reemplazar `app/admin/clases/page.tsx`**

```tsx
import { CalendarioClases } from "@/components/calendario/calendario-clases";
import {
  obtenerClases,
  obtenerSesiones,
  obtenerReservas,
  obtenerClientes,
  obtenerUsuarios,
  obtenerPlanes,
} from "@/lib/supabase/queries";

export default async function AdminClasesPage() {
  const [clases, sesiones, reservas, clientes, usuarios, planes] = await Promise.all([
    obtenerClases(),
    obtenerSesiones(),
    obtenerReservas(),
    obtenerClientes(),
    obtenerUsuarios(),
    obtenerPlanes(),
  ]);

  const ahora = new Date().toISOString();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Clases</h1>
      <CalendarioClases
        hoy={ahora.slice(0, 10)}
        ahora={ahora}
        clases={clases}
        sesiones={sesiones}
        reservas={reservas}
        clientes={clientes}
        usuarios={usuarios}
        planes={planes}
        puedeQuitar
      />
    </div>
  );
}
```

- [ ] **Step 4: Reemplazar `app/entrenador/clases/page.tsx`**

Idéntica salvo el nombre del componente de página y `puedeQuitar={false}`:

```tsx
import { CalendarioClases } from "@/components/calendario/calendario-clases";
import {
  obtenerClases,
  obtenerSesiones,
  obtenerReservas,
  obtenerClientes,
  obtenerUsuarios,
  obtenerPlanes,
} from "@/lib/supabase/queries";

export default async function EntrenadorClasesPage() {
  const [clases, sesiones, reservas, clientes, usuarios, planes] = await Promise.all([
    obtenerClases(),
    obtenerSesiones(),
    obtenerReservas(),
    obtenerClientes(),
    obtenerUsuarios(),
    obtenerPlanes(),
  ]);

  const ahora = new Date().toISOString();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Clases</h1>
      <CalendarioClases
        hoy={ahora.slice(0, 10)}
        ahora={ahora}
        clases={clases}
        sesiones={sesiones}
        reservas={reservas}
        clientes={clientes}
        usuarios={usuarios}
        planes={planes}
        puedeQuitar={false}
      />
    </div>
  );
}
```

- [ ] **Step 5: Borrar el componente antiguo**

```bash
git rm components/calendario-semanal.tsx
```

- [ ] **Step 6: Verificar compilación y arranque**

Run: `npx tsc --noEmit`
Expected: sin errores (nadie importa ya `CalendarioSemanal`).

Run: `npm run build`
Expected: build correcto.

- [ ] **Step 7: Commit**

```bash
git add components/calendario app/admin/clases/page.tsx app/entrenador/clases/page.tsx
git commit -m "feat: calendario con vistas dia, semana y mes para Elena e Ivan"
```

---

### Task 9: Ficha de clienta

**Files:**
- Create: `components/ficha-cliente.tsx`
- Create: `app/admin/clientes/[id]/page.tsx`
- Create: `app/entrenador/clientes/[id]/page.tsx`
- Modify: `components/lista-clientes.tsx`
- Modify: `app/admin/clientes/page.tsx`
- Modify: `app/entrenador/clientes/page.tsx`

**Interfaces:**
- Consumes: `obtenerHistorialDeCliente` (Task 5), `lib/fechas.ts` (Task 4).
- Produces: `<FichaCliente ... />` y las dos rutas de detalle.

- [ ] **Step 1: Crear `components/ficha-cliente.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BadgeEstado } from "./badge-estado";
import { planPorId, creditosRestantes } from "@/lib/selectors";
import { formatearDiaLargo } from "@/lib/fechas";
import type {
  Cliente, Usuario, Plan, Pago, BonoCliente, MovimientoHistorial, Sesion, Clase,
} from "@/lib/types";

interface Props {
  cliente: Cliente;
  usuario: Usuario;
  planes: Plan[];
  pagos: Pago[];
  bonos: BonoCliente[];
  historial: MovimientoHistorial[];
  sesiones: Sesion[];
  clases: Clase[];
}

const ETIQUETA_EVENTO: Record<string, string> = {
  apuntado: "Se apunto",
  en_lista_espera: "Entro en lista de espera",
  desapuntado: "Se desapunto",
  promovido_desde_lista_espera: "Entro desde lista de espera",
  asistio: "Vino",
  no_asistio: "Falto",
  asistencia_corregida: "Asistencia corregida",
};

export function FichaCliente({ cliente, usuario, planes, pagos, bonos, historial, sesiones, clases }: Props) {
  const plan = planPorId(planes, cliente.planId);
  const hoy = new Date().toISOString().slice(0, 10);
  const bonosActivos = bonos.filter((b) => b.activo && (!b.fechaCaducidad || b.fechaCaducidad >= hoy));

  function descripcionDeSesion(sesionId: string): string {
    const sesion = sesiones.find((s) => s.id === sesionId);
    if (!sesion) return "Clase eliminada";
    const clase = clases.find((c) => c.id === sesion.claseId);
    return `${formatearDiaLargo(sesion.fecha)}${clase ? ` · ${clase.horaInicio}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{usuario.nombre}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {usuario.email} · {usuario.telefono}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Estado:</span>
            <BadgeEstado estado={cliente.estado} />
          </div>
          <p>
            <span className="text-muted-foreground">Plan: </span>
            {plan?.nombre ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Dias por semana: </span>
            {cliente.diasSemanaHabituales}
          </p>
          {cliente.deudaCreditos > 0 && (
            <p className="text-amber-700">
              Tiene {cliente.deudaCreditos} sesion(es) de deuda, se descontaran de su proximo bono.
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Notas de rutina: </span>
            {cliente.notasRutina || "—"}
          </p>
        </CardContent>
      </Card>

      {bonosActivos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bonos activos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {bonosActivos.map((bono) => (
              <div key={bono.id} className="flex items-center justify-between">
                <span>
                  {bono.tipo === "recuperacion" ? "Bono de recuperacion" : "Bono"} ·{" "}
                  {creditosRestantes(bono)} de {bono.creditosTotales}
                </span>
                <span className="text-muted-foreground">
                  {bono.fechaCaducidad ? `caduca ${bono.fechaCaducidad}` : "sin caducidad"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de pagos</CardTitle>
        </CardHeader>
        <CardContent>
          {pagos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Importe</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagos.map((pago) => (
                  <TableRow key={pago.id}>
                    <TableCell>{pago.fechaPago}</TableCell>
                    <TableCell>{pago.importe} €</TableCell>
                    <TableCell>{pago.metodo}</TableCell>
                    <TableCell>
                      <BadgeEstado estado={pago.estado} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de asistencia</CardTitle>
        </CardHeader>
        <CardContent>
          {historial.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos todavia.</p>
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              {historial.map((movimiento) => (
                <div key={movimiento.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-b-0">
                  <span>{ETIQUETA_EVENTO[movimiento.evento] ?? movimiento.evento}</span>
                  <span className="text-muted-foreground">{descripcionDeSesion(movimiento.sesionId)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Crear `app/admin/clientes/[id]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaCliente } from "@/components/ficha-cliente";
import {
  obtenerClientes,
  obtenerUsuarios,
  obtenerPlanes,
  obtenerPagos,
  obtenerBonosCliente,
  obtenerSesiones,
  obtenerClases,
  obtenerHistorialDeCliente,
} from "@/lib/supabase/queries";
import { clientePorId, usuarioPorId } from "@/lib/selectors";

export default async function AdminFichaClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [clientes, usuarios, planes, pagos, bonos, sesiones, clases, historial] = await Promise.all([
    obtenerClientes(),
    obtenerUsuarios(),
    obtenerPlanes(),
    obtenerPagos(),
    obtenerBonosCliente(),
    obtenerSesiones(),
    obtenerClases(),
    obtenerHistorialDeCliente(id),
  ]);

  const cliente = clientePorId(clientes, id);
  if (!cliente) notFound();
  const usuario = usuarioPorId(usuarios, cliente.usuarioId);
  if (!usuario) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/clientes" className="text-sm text-muted-foreground hover:underline">
        ← Volver a clientes
      </Link>
      <FichaCliente
        cliente={cliente}
        usuario={usuario}
        planes={planes}
        pagos={pagos.filter((p) => p.clienteId === cliente.id)}
        bonos={bonos.filter((b) => b.clienteId === cliente.id)}
        historial={historial}
        sesiones={sesiones}
        clases={clases}
      />
    </div>
  );
}
```

- [ ] **Step 3: Crear `app/entrenador/clientes/[id]/page.tsx`**

Idéntica, cambiando el nombre del componente a `EntrenadorFichaClientePage` y el enlace de vuelta a `/entrenador/clientes`.

- [ ] **Step 4: Añadir el enlace en `components/lista-clientes.tsx`**

Añadir `import Link from "next/link";` en la cabecera, añadir `basePath: string;` a `Props` (y al destructuring de la firma), y reemplazar la celda del nombre:

```tsx
                <TableCell className="font-medium">{usuario.nombre}</TableCell>
```

por:

```tsx
                <TableCell className="font-medium">
                  <Link href={`${basePath}/${cliente.id}`} className="hover:underline">
                    {usuario.nombre}
                  </Link>
                </TableCell>
```

- [ ] **Step 5: Pasar `basePath` desde las dos páginas de listado**

En `app/admin/clientes/page.tsx`, cambiar el uso del componente a:

```tsx
      <ListaClientes clientes={clientes} usuarios={usuarios} planes={planes} basePath="/admin/clientes" />
```

En `app/entrenador/clientes/page.tsx`, añadir de la misma forma `basePath="/entrenador/clientes"` conservando la prop `soloLectura` que ya lleva.

- [ ] **Step 6: Verificar compilación y build**

Run: `npx tsc --noEmit && npm run build`
Expected: ambos correctos.

- [ ] **Step 7: Commit**

```bash
git add components/ficha-cliente.tsx components/lista-clientes.tsx app/admin/clientes app/entrenador/clientes
git commit -m "feat: ficha de clienta con historial de pagos y asistencia"
```

---

### Task 10: Retoques en la vista de la clienta

**Files:**
- Modify: `components/horario-cliente.tsx`
- Modify: `app/cliente/page.tsx`

**Interfaces:**
- Produces: `<HorarioCliente clienteId hoy limite sesionesLibres clases sesiones reservas />` — el conteo exacto de plazas deja de llegar al navegador.

- [ ] **Step 1: Reemplazar `components/horario-cliente.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { reservaActivaDeClienteEnSesion } from "@/lib/selectors";
import { formatearDiaLargo } from "@/lib/fechas";
import { BadgeEstado } from "./badge-estado";
import { reservarSesion, cancelarReserva } from "@/lib/actions/reservas";
import type { Clase, Sesion, Reserva } from "@/lib/types";

interface Props {
  clienteId: string;
  hoy: string;
  limite: string;
  // Elena pidio que la clienta no vea cuantas plazas quedan, para que no elija
  // las clases con menos gente: al navegador solo llega si hay hueco o no.
  sesionesLibres: Record<string, boolean>;
  clases: Clase[];
  sesiones: Sesion[];
  reservas: Reserva[];
}

export function HorarioCliente({ clienteId, hoy, limite, sesionesLibres, clases, sesiones, reservas }: Props) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reservar(sesionId: string) {
    setError(null);
    startTransition(async () => {
      const respuesta = await reservarSesion(sesionId, clienteId);
      if (respuesta.error) setError(respuesta.error);
    });
  }

  function cancelar(reservaId: string) {
    setError(null);
    startTransition(async () => {
      const respuesta = await cancelarReserva(reservaId);
      if (respuesta.error) setError(respuesta.error);
    });
  }

  // Solo se muestran las sesiones reservables: desde hoy hasta el limite de la
  // ventana. Antes salian tarjetas que el sistema rechazaba al pulsarlas.
  const visibles = sesiones
    .filter((s) => s.fecha >= hoy && s.fecha <= limite)
    .map((s) => ({ sesion: s, clase: clases.find((c) => c.id === s.claseId) }))
    .filter((x): x is { sesion: Sesion; clase: Clase } => Boolean(x.clase))
    .sort((a, b) =>
      a.sesion.fecha === b.sesion.fecha
        ? a.clase.horaInicio.localeCompare(b.clase.horaInicio)
        : a.sesion.fecha.localeCompare(b.sesion.fecha)
    );

  if (visibles.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay clases disponibles ahora mismo.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibles.map(({ sesion, clase }) => {
          const hayHueco = sesionesLibres[sesion.id] ?? false;
          const miReserva = reservaActivaDeClienteEnSesion(reservas, clienteId, sesion.id);
          return (
            <Card key={sesion.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {formatearDiaLargo(sesion.fecha)}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {clase.horaInicio} - {clase.horaFin} · {hayHueco ? "Libre" : "Completo"}
                </p>
              </CardHeader>
              <CardContent>
                {miReserva ? (
                  <div className="flex items-center justify-between">
                    <BadgeEstado estado={miReserva.estado} />
                    <Button variant="outline" size="sm" disabled={pendiente} onClick={() => cancelar(miReserva.id)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" disabled={pendiente} onClick={() => reservar(sesion.id)}>
                    {hayHueco ? "Reservar" : "Unirse a lista de espera"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Actualizar `app/cliente/page.tsx`**

Añadir `sumarDias` al import de `@/lib/fechas`, y reemplazar el cálculo y el uso del componente. El bloque desde `if (!cliente) redirect("/login");` hasta el final de la función pasa a ser:

```tsx
  if (!cliente) redirect("/login");
  const usuario = usuarioPorId(usuarios, user.id);
  if (!usuario) redirect("/login");

  // El conteo exacto se resuelve aqui y nunca llega al navegador de la clienta.
  const hoy = new Date().toISOString().slice(0, 10);
  const limite = sumarDias(hoy, 21);
  const sesionesLibres: Record<string, boolean> = {};
  for (const sesion of sesiones) {
    const clase = clases.find((c) => c.id === sesion.claseId);
    if (!clase) continue;
    const aforo = sesion.aforoEfectivo ?? clase.aforoMax;
    sesionesLibres[sesion.id] = (ocupacion[sesion.id] ?? 0) < aforo;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Hola, {usuario.nombre}</h1>
      <MiPlan cliente={cliente} planes={planes} pagos={pagos} bonosCliente={bonosCliente} />
      <div>
        <h2 className="mb-3 text-lg font-medium">Proximas clases</h2>
        <HorarioCliente
          clienteId={cliente.id}
          hoy={hoy}
          limite={limite}
          sesionesLibres={sesionesLibres}
          clases={clases}
          sesiones={sesiones}
          reservas={reservas}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar compilación y build**

Run: `npx tsc --noEmit && npm run build`
Expected: ambos correctos.

- [ ] **Step 4: Correr la suite de integración**

Run: `npm run test:integration`
Expected: todos los tests pasan (nada de esta tarea toca la capa de datos, pero se confirma que no hay regresión).

- [ ] **Step 5: Commit**

```bash
git add components/horario-cliente.tsx app/cliente/page.tsx
git commit -m "feat: la clienta ve libre/completo y solo las clases reservables"
```

---

### Task 11: Repaso manual con las cuentas demo

**Files:** ninguno — es una verificación.

- [ ] **Step 1: Arrancar la app**

Run: `npm run dev`
Abrir la URL que imprima (3000, o 3001 si el puerto está ocupado).

- [ ] **Step 2: Recorrer los flujos**

Con el acceso rápido de `/login`:

1. **Elena** → Clases. Abre en hoy. Cambiar a Semana y a Mes, y volver pulsando un día de la rejilla. Comprobar que el botón "Hoy" vuelve a la fecha de hoy.
2. **Elena** → Clases → un día ya pasado con reservas. Marcar "Falto" a alguien, luego "Sin marcar". Comprobar que no da error.
3. **Elena** → Clientes → pulsar un nombre. Ver la ficha con sus pagos y su historial, incluido el movimiento de asistencia del paso anterior.
4. **Elena** → Clases → un día futuro. Los botones de asistencia salen desactivados con el aviso de que la clase no ha empezado. El botón "Quitar" sí aparece.
5. **Iván** → Clases. Todo igual salvo que **no** aparece el botón "Quitar".
6. **María** (clienta) → ve "Libre"/"Completo", nunca un número, y solo clases dentro de las tres semanas.

- [ ] **Step 3: Anotar lo que falle**

Cualquier fallo se arregla antes de dar la tarea por buena. Si algo requiere una decisión de producto, reportarlo en vez de improvisar.

---

## Self-Review Notes

- **Cobertura del diseño**: calendario con tres vistas (Tasks 6-8), asistencia reversible con guarda de fecha y ajuste de deuda por transición (Task 1, probada en Task 3), botón de quitar solo para Elena con confirmación que avisa del crédito (Task 6), ficha de clienta con pagos e historial (Tasks 5 y 9), y los tres retoques de la vista de la clienta (Task 10).
- **Fuera a propósito**: crear/editar clases y sesiones, copiar semana, registrar bonos, ajustar aforo, compensar créditos, blindar el aforo a nivel de API. Todo depende de la conversación pendiente con la clienta.
- **Consistencia de tipos**: `marcar_asistencia(p_reserva_id, p_asistencia)` se usa igual en Task 1 (SQL), Task 2 (`marcarAsistencia`), Task 3 (tests) y Task 6 (`VistaDia`). `MovimientoHistorial` se define en Task 5 y se consume en Task 9. Las funciones de `lib/fechas.ts` (Task 4) se usan en Tasks 6, 7, 8, 9 y 10.
- **Consecuencia conocida y aceptada**: la guarda "no se puede cancelar con la asistencia registrada" queda inalcanzable por uso legítimo, porque la asistencia solo se marca sobre clases ya empezadas y esas no se pueden cancelar. Se mantiene como defensa en profundidad y su test pasa a preparar el estado con el cliente admin (Task 3, Step 2).
- **Limitación declarada**: ocultar el aforo evita que el número llegue a la página, pero sigue siendo consultable por API. Está anotado en `docs/deuda-tecnica.md` y en la lista de preguntas para la clienta.
