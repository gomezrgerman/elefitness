# Elefitness — Sprint 1+2 Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-memory mock demo (`lib/mock-store.tsx` + `lib/mock-data.ts`) with a real Supabase backend (Postgres + RLS + Auth), keeping the existing UI components, so Germán can show Elena a working app on Monday 2026-08-03.

**Architecture:** Postgres schema + RLS policies + two SECURITY DEFINER RPC functions (`reservar_clase`, `cancelar_reserva`) hold the business logic that needs atomic, cross-row access. Server Components read via a thin query layer that maps snake_case DB rows to the existing camelCase `lib/types.ts` shapes. Server Actions (Zod-validated) handle all writes. `@supabase/ssr` handles auth/session; middleware enforces role-based routing. No client-side global store.

**Tech Stack:** Next.js 15 App Router, `@supabase/supabase-js`, `@supabase/ssr`, Zod, Vitest (integration tests against the real Supabase project), `tsx` for the seed script.

**Reference:** `docs/superpowers/specs/2026-07-31-sprint1-supabase-design.md` (approved spec this plan implements).

## Global Constraints

- Supabase project `pdvpruktssojuicwhhlt` is already provisioned and confirmed empty. Credentials already exist in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) — do not print their values to logs or commit them.
- Tables: `centro, users, clientes, planes, clases, reservas, pagos, bonos_cliente`. `public.users.id` references `auth.users.id` directly (no separate profile table).
- RLS on every table: `admin` full access; `entrenador` `SELECT`-only everywhere; `cliente` `SELECT`-only on reference tables (`centro`, `planes`, `clases`) and `SELECT`-only on own rows in `clientes`/`reservas`/`pagos`/`bonos_cliente` (never direct `INSERT`/`UPDATE`/`DELETE` — writes to `reservas` only via RPC).
- `reservar_clase` / `cancelar_reserva` are `SECURITY DEFINER` SQL functions with an explicit `auth.uid()` ownership check as their first statement (admin bypasses the check).
- `SUPABASE_SERVICE_ROLE_KEY` is used only in server-only files (seed script, `lib/supabase/admin.ts`) — never imported by a Client Component, never sent to Vercel.
- Out of scope for this plan (do not build): Stripe checkout/webhooks, Resend emails, PWA, real Harbiz data migration, self-service password/invite flow for real clientas.
- Do not check off any Sprint box in `CLAUDE.md` until this plan is fully verified and Elena has seen it working.
- Reuse existing UI components/types as-is where possible: `lib/types.ts`, `lib/selectors.ts`, `lib/validaciones.ts` do not change.

---

## Task 1: Database schema migration + generated types

**Files:**
- Create: `supabase/migrations/0001_schema.sql`
- Create: `lib/database.types.ts` (generated, not hand-written)

**Interfaces:**
- Produces: Postgres tables `centro, users, clientes, planes, clases, reservas, pagos, bonos_cliente` with enum types `rol_enum, dia_semana_enum, estado_cliente_enum, tipo_plan_enum, estado_reserva_enum, metodo_pago_enum, estado_pago_enum`. Column names are snake_case (`usuario_id`, `plan_id`, `notas_rutina`, `hora_inicio`, etc.) — later tasks map these to the existing camelCase `lib/types.ts` shapes.

- [ ] **Step 1: Write the schema migration**

```sql
-- supabase/migrations/0001_schema.sql
create extension if not exists pgcrypto;

create type rol_enum as enum ('admin', 'entrenador', 'cliente');
create type dia_semana_enum as enum ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo');
create type estado_cliente_enum as enum ('activo', 'baja');
create type tipo_plan_enum as enum ('mensual', 'bono');
create type estado_reserva_enum as enum ('confirmada', 'lista_espera', 'cancelada');
create type metodo_pago_enum as enum ('stripe', 'efectivo', 'transferencia');
create type estado_pago_enum as enum ('al_dia', 'moroso', 'pendiente');

create table public.centro (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  logo_url text,
  color_marca text not null default '#16A34A',
  stripe_account_id text
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  rol rol_enum not null,
  nombre text not null,
  telefono text not null default ''
);

create table public.planes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  precio numeric(10,2) not null,
  tipo tipo_plan_enum not null,
  clases_incluidas integer,
  stripe_price_id text
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.users(id) on delete cascade,
  estado estado_cliente_enum not null default 'activo',
  plan_id uuid not null references public.planes(id),
  notas_rutina text not null default '',
  created_at timestamptz not null default now(),
  unique (usuario_id)
);

create table public.clases (
  id uuid primary key default gen_random_uuid(),
  dia dia_semana_enum not null,
  hora_inicio time not null,
  hora_fin time not null,
  aforo_max integer not null,
  entrenador_id uuid not null references public.users(id),
  recurrente boolean not null default true
);

create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  clase_id uuid not null references public.clases(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  estado estado_reserva_enum not null default 'confirmada',
  created_at timestamptz not null default now()
);

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  plan_id uuid not null references public.planes(id),
  tipo tipo_plan_enum not null,
  metodo metodo_pago_enum not null,
  stripe_subscription_id text,
  estado estado_pago_enum not null default 'pendiente',
  importe numeric(10,2) not null,
  fecha_pago date not null,
  ultimo_cobro date,
  proximo_cobro date,
  registrado_por uuid not null references public.users(id)
);

create table public.bonos_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  plan_id uuid not null references public.planes(id),
  creditos_totales integer not null,
  creditos_usados integer not null default 0,
  fecha_compra date not null,
  activo boolean not null default true
);
```

- [ ] **Step 2: Link the local project to the remote Supabase project and push the migration**

These two commands are interactive (they open a browser for auth) — Germán runs them himself, same as the existing `npx vercel login` pattern in `README.md`:

```bash
npx supabase login
npx supabase link --project-ref pdvpruktssojuicwhhlt
```

Then push the migration:

```bash
npx supabase db push
```

- [ ] **Step 3: Verify the schema applied**

```bash
npx supabase db execute --sql "select table_name from information_schema.tables where table_schema = 'public' order by table_name;"
```

Expected: the 8 table names (`bonos_cliente, centro, clases, clientes, pagos, planes, reservas, users`).

- [ ] **Step 4: Generate TypeScript types from the live schema**

```bash
npx supabase gen types typescript --project-id pdvpruktssojuicwhhlt --schema public > lib/database.types.ts
```

Expected: `lib/database.types.ts` is created/overwritten with a non-empty `Database` type containing all 8 tables under `public: { Tables: { ... } }`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_schema.sql lib/database.types.ts
git commit -m "feat: add Supabase schema migration and generated types"
```

---

## Task 2: RLS policies + `auth_rol()` helper

**Files:**
- Create: `supabase/migrations/0002_rls.sql`

**Interfaces:**
- Consumes: tables from Task 1.
- Produces: `public.auth_rol() returns rol_enum` (used by Task 3's RPCs too), RLS enabled + policies on all 8 tables.

- [ ] **Step 1: Write the RLS migration**

```sql
-- supabase/migrations/0002_rls.sql
create or replace function public.auth_rol()
returns rol_enum
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.users where id = auth.uid();
$$;

alter table public.centro enable row level security;
alter table public.users enable row level security;
alter table public.planes enable row level security;
alter table public.clases enable row level security;
alter table public.clientes enable row level security;
alter table public.reservas enable row level security;
alter table public.pagos enable row level security;
alter table public.bonos_cliente enable row level security;

-- centro (tabla de referencia)
create policy "centro_admin_all" on public.centro for all to authenticated
  using (public.auth_rol() = 'admin') with check (public.auth_rol() = 'admin');
create policy "centro_entrenador_select" on public.centro for select to authenticated
  using (public.auth_rol() = 'entrenador');
create policy "centro_cliente_select" on public.centro for select to authenticated
  using (public.auth_rol() = 'cliente');

-- planes (tabla de referencia)
create policy "planes_admin_all" on public.planes for all to authenticated
  using (public.auth_rol() = 'admin') with check (public.auth_rol() = 'admin');
create policy "planes_entrenador_select" on public.planes for select to authenticated
  using (public.auth_rol() = 'entrenador');
create policy "planes_cliente_select" on public.planes for select to authenticated
  using (public.auth_rol() = 'cliente');

-- clases (tabla de referencia)
create policy "clases_admin_all" on public.clases for all to authenticated
  using (public.auth_rol() = 'admin') with check (public.auth_rol() = 'admin');
create policy "clases_entrenador_select" on public.clases for select to authenticated
  using (public.auth_rol() = 'entrenador');
create policy "clases_cliente_select" on public.clases for select to authenticated
  using (public.auth_rol() = 'cliente');

-- users
create policy "users_admin_all" on public.users for all to authenticated
  using (public.auth_rol() = 'admin') with check (public.auth_rol() = 'admin');
create policy "users_entrenador_select" on public.users for select to authenticated
  using (public.auth_rol() = 'entrenador');
create policy "users_cliente_select_own" on public.users for select to authenticated
  using (id = auth.uid());

-- clientes
create policy "clientes_admin_all" on public.clientes for all to authenticated
  using (public.auth_rol() = 'admin') with check (public.auth_rol() = 'admin');
create policy "clientes_entrenador_select" on public.clientes for select to authenticated
  using (public.auth_rol() = 'entrenador');
create policy "clientes_cliente_select_own" on public.clientes for select to authenticated
  using (usuario_id = auth.uid());

-- reservas (escritura de cliente solo via RPC SECURITY DEFINER, no hay policy de INSERT/UPDATE para cliente)
create policy "reservas_admin_all" on public.reservas for all to authenticated
  using (public.auth_rol() = 'admin') with check (public.auth_rol() = 'admin');
create policy "reservas_entrenador_select" on public.reservas for select to authenticated
  using (public.auth_rol() = 'entrenador');
create policy "reservas_cliente_select_own" on public.reservas for select to authenticated
  using (exists (select 1 from public.clientes c where c.id = reservas.cliente_id and c.usuario_id = auth.uid()));

-- pagos (solo lectura para cliente; registrar pago es admin only)
create policy "pagos_admin_all" on public.pagos for all to authenticated
  using (public.auth_rol() = 'admin') with check (public.auth_rol() = 'admin');
create policy "pagos_entrenador_select" on public.pagos for select to authenticated
  using (public.auth_rol() = 'entrenador');
create policy "pagos_cliente_select_own" on public.pagos for select to authenticated
  using (exists (select 1 from public.clientes c where c.id = pagos.cliente_id and c.usuario_id = auth.uid()));

-- bonos_cliente (solo lectura para cliente)
create policy "bonos_admin_all" on public.bonos_cliente for all to authenticated
  using (public.auth_rol() = 'admin') with check (public.auth_rol() = 'admin');
create policy "bonos_entrenador_select" on public.bonos_cliente for select to authenticated
  using (public.auth_rol() = 'entrenador');
create policy "bonos_cliente_select_own" on public.bonos_cliente for select to authenticated
  using (exists (select 1 from public.clientes c where c.id = bonos_cliente.cliente_id and c.usuario_id = auth.uid()));
```

- [ ] **Step 2: Push the migration**

```bash
npx supabase db push
```

- [ ] **Step 3: Verify RLS blocks anonymous reads**

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/centro" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Expected: `[]` (empty array — RLS is enabled and no policy grants access to an unauthenticated/anon-role request, since every policy above is scoped `to authenticated`).

(Full authenticated-session RLS assertions — "Maria can't read Laura's rows", "Ivan can't write" — are covered by the automated tests in Task 6, once seed accounts exist to sign in as.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_rls.sql
git commit -m "feat: add RLS policies for all tables"
```

---

## Task 3: RPC functions — `reservar_clase`, `cancelar_reserva`, `ocupacion_clases`

**Files:**
- Create: `supabase/migrations/0003_rpc.sql`

**Interfaces:**
- Consumes: `public.auth_rol()` from Task 2.
- Produces: `public.reservar_clase(p_clase_id uuid, p_cliente_id uuid) returns public.reservas`, `public.cancelar_reserva(p_reserva_id uuid) returns public.reservas`, `public.ocupacion_clases() returns table(clase_id uuid, confirmadas integer)` — all `SECURITY DEFINER`, `EXECUTE` granted to `authenticated` only. Later tasks call these via `supabase.rpc(...)`.

**Design note (found while planning, not in the original spec):** the cliente-facing schedule (`HorarioCliente`) needs to know how many seats are taken in *every* class to compute "plazas libres", but the RLS policy on `reservas` only lets a cliente `SELECT` their own rows — so a plain client-side count would always show 0/1 taken. `ocupacion_clases()` is a `SECURITY DEFINER` function that returns aggregate counts only (no cliente identities), solving this without loosening the RLS policy on `reservas`.

- [ ] **Step 1: Write the RPC migration**

```sql
-- supabase/migrations/0003_rpc.sql
create or replace function public.reservar_clase(p_clase_id uuid, p_cliente_id uuid)
returns public.reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autorizado boolean;
  v_clase public.clases;
  v_cliente public.clientes;
  v_plan public.planes;
  v_bono public.bonos_cliente;
  v_confirmadas integer;
  v_estado estado_reserva_enum;
  v_reserva public.reservas;
begin
  select (
    exists (select 1 from public.clientes c where c.id = p_cliente_id and c.usuario_id = auth.uid())
    or public.auth_rol() = 'admin'
  ) into v_autorizado;

  if not v_autorizado then
    raise exception 'No autorizado para reservar en nombre de esta clienta';
  end if;

  select * into v_clase from public.clases where id = p_clase_id;
  if not found then
    raise exception 'Clase no encontrada';
  end if;

  select * into v_cliente from public.clientes where id = p_cliente_id;
  if not found then
    raise exception 'Cliente no encontrado';
  end if;

  if exists (
    select 1 from public.reservas
    where clase_id = p_clase_id and cliente_id = p_cliente_id and estado <> 'cancelada'
  ) then
    raise exception 'Ya existe una reserva activa para esta clase';
  end if;

  select * into v_plan from public.planes where id = v_cliente.plan_id;

  if v_plan.tipo = 'bono' then
    select * into v_bono from public.bonos_cliente
      where cliente_id = p_cliente_id and activo = true
      order by fecha_compra desc limit 1;
    if not found or (v_bono.creditos_totales - v_bono.creditos_usados) <= 0 then
      raise exception 'No quedan creditos de bono disponibles';
    end if;
  end if;

  select count(*) into v_confirmadas from public.reservas
    where clase_id = p_clase_id and estado = 'confirmada';

  v_estado := case when v_confirmadas < v_clase.aforo_max then 'confirmada' else 'lista_espera' end;

  insert into public.reservas (clase_id, cliente_id, estado)
  values (p_clase_id, p_cliente_id, v_estado)
  returning * into v_reserva;

  if v_estado = 'confirmada' and v_plan.tipo = 'bono' then
    update public.bonos_cliente set creditos_usados = creditos_usados + 1 where id = v_bono.id;
  end if;

  return v_reserva;
end;
$$;

revoke all on function public.reservar_clase(uuid, uuid) from public;
grant execute on function public.reservar_clase(uuid, uuid) to authenticated;

create or replace function public.cancelar_reserva(p_reserva_id uuid)
returns public.reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autorizado boolean;
  v_reserva public.reservas;
  v_estado_original estado_reserva_enum;
  v_cliente public.clientes;
  v_plan public.planes;
  v_bono public.bonos_cliente;
  v_siguiente public.reservas;
  v_cliente_siguiente public.clientes;
  v_plan_siguiente public.planes;
  v_bono_siguiente public.bonos_cliente;
begin
  select * into v_reserva from public.reservas where id = p_reserva_id;
  if not found then
    raise exception 'Reserva no encontrada';
  end if;

  select (
    exists (select 1 from public.clientes c where c.id = v_reserva.cliente_id and c.usuario_id = auth.uid())
    or public.auth_rol() = 'admin'
  ) into v_autorizado;

  if not v_autorizado then
    raise exception 'No autorizado para cancelar esta reserva';
  end if;

  if v_reserva.estado = 'cancelada' then
    raise exception 'La reserva ya estaba cancelada';
  end if;

  v_estado_original := v_reserva.estado;

  update public.reservas set estado = 'cancelada' where id = p_reserva_id returning * into v_reserva;

  if v_estado_original = 'confirmada' then
    select * into v_cliente from public.clientes where id = v_reserva.cliente_id;
    select * into v_plan from public.planes where id = v_cliente.plan_id;

    if v_plan.tipo = 'bono' then
      select * into v_bono from public.bonos_cliente
        where cliente_id = v_reserva.cliente_id and activo = true
        order by fecha_compra desc limit 1;
      if found then
        update public.bonos_cliente
          set creditos_usados = greatest(0, creditos_usados - 1)
          where id = v_bono.id;
      end if;
    end if;

    select * into v_siguiente from public.reservas
      where clase_id = v_reserva.clase_id and estado = 'lista_espera'
      order by created_at asc limit 1;

    if found then
      update public.reservas set estado = 'confirmada' where id = v_siguiente.id;

      select * into v_cliente_siguiente from public.clientes where id = v_siguiente.cliente_id;
      select * into v_plan_siguiente from public.planes where id = v_cliente_siguiente.plan_id;

      if v_plan_siguiente.tipo = 'bono' then
        select * into v_bono_siguiente from public.bonos_cliente
          where cliente_id = v_siguiente.cliente_id and activo = true
          order by fecha_compra desc limit 1;
        if found then
          update public.bonos_cliente
            set creditos_usados = creditos_usados + 1
            where id = v_bono_siguiente.id;
        end if;
      end if;
    end if;
  end if;

  return v_reserva;
end;
$$;

revoke all on function public.cancelar_reserva(uuid) from public;
grant execute on function public.cancelar_reserva(uuid) to authenticated;

create or replace function public.ocupacion_clases()
returns table (clase_id uuid, confirmadas integer)
language sql
stable
security definer
set search_path = public
as $$
  select clase_id, count(*)::integer as confirmadas
  from public.reservas
  where estado = 'confirmada'
  group by clase_id;
$$;

revoke all on function public.ocupacion_clases() from public;
grant execute on function public.ocupacion_clases() to authenticated;
```

- [ ] **Step 2: Push the migration**

```bash
npx supabase db push
```

- [ ] **Step 3: Verify the functions exist**

```bash
npx supabase db execute --sql "select proname from pg_proc where pronamespace = 'public'::regnamespace and proname in ('reservar_clase', 'cancelar_reserva', 'ocupacion_clases');"
```

Expected: all three function names listed.

(Behavioral testing of these functions — aforo lleno, bono sin créditos, promoción de lista de espera — happens in Task 6, once seed data and a JS client exist to call them as a real authenticated user.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_rpc.sql
git commit -m "feat: add reservar_clase, cancelar_reserva, ocupacion_clases RPCs"
```

---

## Task 4: Supabase clients in the app (browser / server / admin)

**Files:**
- Modify: `package.json` (add `@supabase/supabase-js`, `@supabase/ssr` deps; add `dotenv`, `tsx`, `vitest` devDeps; add `seed` and `test:integration` scripts)
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/admin.ts`

**Interfaces:**
- Consumes: `Database` type from `lib/database.types.ts` (Task 1).
- Produces: `createClient()` (browser, sync) from `lib/supabase/client.ts`; `createClient()` (server, async) from `lib/supabase/server.ts`; `createAdminClient()` from `lib/supabase/admin.ts`. These exact names/signatures are used by every later task.

- [ ] **Step 1: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D dotenv tsx vitest
```

- [ ] **Step 2: Add npm scripts**

Edit `package.json` `"scripts"`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "seed": "tsx scripts/seed.ts",
    "test:integration": "vitest run"
  }
}
```

- [ ] **Step 3: Create the browser client**

```ts
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 4: Create the server client**

```ts
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component sin permiso de escritura de cookies; el middleware ya refresca la sesion.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 5: Create the admin (service role) client**

```ts
// lib/supabase/admin.ts
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no esta definida. Este cliente solo puede usarse en local/servidor.");
  }
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 6: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors referencing `lib/supabase/*.ts`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/supabase/client.ts lib/supabase/server.ts lib/supabase/admin.ts
git commit -m "feat: add Supabase browser, server, and admin clients"
```

---

## Task 5: Seed script

**Files:**
- Create: `lib/demo-accounts.ts`
- Create: `scripts/seed.ts`

**Interfaces:**
- Consumes: `createAdminClient()` from Task 4.
- Produces: `DEMO_PASSWORD: string`, `DEMO_ACCOUNTS: { email: string; nombre: string; rol: Rol }[]` from `lib/demo-accounts.ts` — used by both this script and the login page (Task 8).
- 10 seeded `auth.users` (all sharing `DEMO_PASSWORD`), 1 centro, 2 planes, 2 clases, 8 clientes, 7 reservas, 8 pagos, 1 bono — same scenario as the old `lib/mock-data.ts`.

- [ ] **Step 1: Write the shared demo accounts constant**

```ts
// lib/demo-accounts.ts
import type { Rol } from "./types";

export const DEMO_PASSWORD = "Elefitness2026!";

export const DEMO_ACCOUNTS: { email: string; nombre: string; rol: Rol }[] = [
  { email: "elena@elefitness.com", nombre: "Elena", rol: "admin" },
  { email: "ivan@elefitness.com", nombre: "Ivan", rol: "entrenador" },
  { email: "maria@example.com", nombre: "Maria Lopez", rol: "cliente" },
  { email: "laura@example.com", nombre: "Laura Fernandez", rol: "cliente" },
  { email: "sara@example.com", nombre: "Sara Gimenez", rol: "cliente" },
];
```

- [ ] **Step 2: Write the seed script**

```ts
// scripts/seed.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { DEMO_PASSWORD } from "../lib/demo-accounts";

const admin = createAdminClient();

interface SeedUsuario {
  email: string;
  nombre: string;
  telefono: string;
  rol: "admin" | "entrenador" | "cliente";
}

const usuarios: SeedUsuario[] = [
  { email: "elena@elefitness.com", nombre: "Elena", telefono: "600111222", rol: "admin" },
  { email: "ivan@elefitness.com", nombre: "Ivan", telefono: "600333444", rol: "entrenador" },
  { email: "maria@example.com", nombre: "Maria Lopez", telefono: "600555001", rol: "cliente" },
  { email: "laura@example.com", nombre: "Laura Fernandez", telefono: "600555002", rol: "cliente" },
  { email: "sara@example.com", nombre: "Sara Gimenez", telefono: "600555003", rol: "cliente" },
  { email: "ana@example.com", nombre: "Ana Ruiz", telefono: "600555004", rol: "cliente" },
  { email: "beatriz@example.com", nombre: "Beatriz Soto", telefono: "600555005", rol: "cliente" },
  { email: "carla@example.com", nombre: "Carla Vidal", telefono: "600555006", rol: "cliente" },
  { email: "diana@example.com", nombre: "Diana Ortiz", telefono: "600555007", rol: "cliente" },
  { email: "eva@example.com", nombre: "Eva Molina", telefono: "600555008", rol: "cliente" },
];

async function main() {
  const { data: centroExistente } = await admin.from("centro").select("id").limit(1);
  if (centroExistente && centroExistente.length > 0) {
    throw new Error("El proyecto ya tiene datos (tabla centro no esta vacia). Aborta para no duplicar seeds.");
  }

  const { error: errorCentro } = await admin.from("centro").insert({ nombre: "Elefitness", color_marca: "#16A34A" });
  if (errorCentro) throw errorCentro;

  const idsPorEmail = new Map<string, string>();
  for (const u of usuarios) {
    const { data: authUser, error: errorAuth } = await admin.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (errorAuth || !authUser.user) throw errorAuth ?? new Error(`No se pudo crear auth user ${u.email}`);

    const { error: errorUsers } = await admin.from("users").insert({
      id: authUser.user.id,
      email: u.email,
      rol: u.rol,
      nombre: u.nombre,
      telefono: u.telefono,
    });
    if (errorUsers) throw errorUsers;

    idsPorEmail.set(u.email, authUser.user.id);
  }

  const { data: planMensual, error: errorPlanMensual } = await admin
    .from("planes")
    .insert({ nombre: "Cuota mensual", precio: 45, tipo: "mensual", clases_incluidas: null })
    .select()
    .single();
  if (errorPlanMensual || !planMensual) throw errorPlanMensual ?? new Error("No se pudo crear plan mensual");

  const { data: planBono, error: errorPlanBono } = await admin
    .from("planes")
    .insert({ nombre: "Bono 10 clases", precio: 80, tipo: "bono", clases_incluidas: 10 })
    .select()
    .single();
  if (errorPlanBono || !planBono) throw errorPlanBono ?? new Error("No se pudo crear plan bono");

  const ivanId = idsPorEmail.get("ivan@elefitness.com")!;
  const { data: claseLunes, error: errorClaseLunes } = await admin
    .from("clases")
    .insert({ dia: "lunes", hora_inicio: "18:00", hora_fin: "19:00", aforo_max: 5, entrenador_id: ivanId, recurrente: true })
    .select()
    .single();
  if (errorClaseLunes || !claseLunes) throw errorClaseLunes ?? new Error("No se pudo crear clase-lunes");

  const { data: claseMiercoles, error: errorClaseMiercoles } = await admin
    .from("clases")
    .insert({ dia: "miercoles", hora_inicio: "19:00", hora_fin: "20:00", aforo_max: 5, entrenador_id: ivanId, recurrente: true })
    .select()
    .single();
  if (errorClaseMiercoles || !claseMiercoles) throw errorClaseMiercoles ?? new Error("No se pudo crear clase-miercoles");

  const clientesSeed = [
    { email: "maria@example.com", planId: planMensual.id, notas: "Full body 3x/semana, foco en tren inferior. Progresar sentadilla goblet." },
    { email: "laura@example.com", planId: planBono.id, notas: "Circuito funcional, cuidado con el hombro derecho." },
    { email: "sara@example.com", planId: planMensual.id, notas: "Readaptacion tras baja, sin saltos todavia." },
    { email: "ana@example.com", planId: planMensual.id, notas: "" },
    { email: "beatriz@example.com", planId: planMensual.id, notas: "" },
    { email: "carla@example.com", planId: planMensual.id, notas: "" },
    { email: "diana@example.com", planId: planMensual.id, notas: "" },
    { email: "eva@example.com", planId: planMensual.id, notas: "" },
  ];

  const idsClientePorEmail = new Map<string, string>();
  for (const c of clientesSeed) {
    const usuarioId = idsPorEmail.get(c.email)!;
    const { data: cliente, error: errorCliente } = await admin
      .from("clientes")
      .insert({ usuario_id: usuarioId, plan_id: c.planId, notas_rutina: c.notas })
      .select()
      .single();
    if (errorCliente || !cliente) throw errorCliente ?? new Error(`No se pudo crear cliente ${c.email}`);
    idsClientePorEmail.set(c.email, cliente.id);
  }

  const idMaria = idsClientePorEmail.get("maria@example.com")!;
  const idLaura = idsClientePorEmail.get("laura@example.com")!;
  const idSara = idsClientePorEmail.get("sara@example.com")!;
  const idAna = idsClientePorEmail.get("ana@example.com")!;
  const idBeatriz = idsClientePorEmail.get("beatriz@example.com")!;
  const idCarla = idsClientePorEmail.get("carla@example.com")!;
  const idDiana = idsClientePorEmail.get("diana@example.com")!;
  const idEva = idsClientePorEmail.get("eva@example.com")!;

  const { error: errorReservas } = await admin.from("reservas").insert([
    { clase_id: claseLunes.id, cliente_id: idMaria, estado: "confirmada" },
    { clase_id: claseMiercoles.id, cliente_id: idAna, estado: "confirmada" },
    { clase_id: claseMiercoles.id, cliente_id: idBeatriz, estado: "confirmada" },
    { clase_id: claseMiercoles.id, cliente_id: idCarla, estado: "confirmada" },
    { clase_id: claseMiercoles.id, cliente_id: idDiana, estado: "confirmada" },
    { clase_id: claseMiercoles.id, cliente_id: idEva, estado: "confirmada" },
    { clase_id: claseMiercoles.id, cliente_id: idLaura, estado: "lista_espera" },
  ]);
  if (errorReservas) throw errorReservas;

  const elenaId = idsPorEmail.get("elena@elefitness.com")!;
  const { error: errorPagos } = await admin.from("pagos").insert([
    { cliente_id: idMaria, plan_id: planMensual.id, tipo: "mensual", metodo: "stripe", estado: "al_dia", importe: 45, fecha_pago: "2026-07-01", ultimo_cobro: "2026-07-01", proximo_cobro: "2026-08-01", registrado_por: elenaId },
    { cliente_id: idLaura, plan_id: planBono.id, tipo: "bono", metodo: "efectivo", estado: "al_dia", importe: 80, fecha_pago: "2026-04-02", ultimo_cobro: "2026-04-02", proximo_cobro: null, registrado_por: elenaId },
    { cliente_id: idSara, plan_id: planMensual.id, tipo: "mensual", metodo: "stripe", estado: "moroso", importe: 45, fecha_pago: "2026-06-01", ultimo_cobro: "2026-06-01", proximo_cobro: "2026-07-01", registrado_por: elenaId },
    { cliente_id: idAna, plan_id: planMensual.id, tipo: "mensual", metodo: "stripe", estado: "al_dia", importe: 45, fecha_pago: "2026-07-01", ultimo_cobro: "2026-07-01", proximo_cobro: "2026-08-01", registrado_por: elenaId },
    { cliente_id: idBeatriz, plan_id: planMensual.id, tipo: "mensual", metodo: "stripe", estado: "al_dia", importe: 45, fecha_pago: "2026-07-01", ultimo_cobro: "2026-07-01", proximo_cobro: "2026-08-01", registrado_por: elenaId },
    { cliente_id: idCarla, plan_id: planMensual.id, tipo: "mensual", metodo: "stripe", estado: "al_dia", importe: 45, fecha_pago: "2026-07-01", ultimo_cobro: "2026-07-01", proximo_cobro: "2026-08-01", registrado_por: elenaId },
    { cliente_id: idDiana, plan_id: planMensual.id, tipo: "mensual", metodo: "stripe", estado: "al_dia", importe: 45, fecha_pago: "2026-07-01", ultimo_cobro: "2026-07-01", proximo_cobro: "2026-08-01", registrado_por: elenaId },
    { cliente_id: idEva, plan_id: planMensual.id, tipo: "mensual", metodo: "stripe", estado: "al_dia", importe: 45, fecha_pago: "2026-07-01", ultimo_cobro: "2026-07-01", proximo_cobro: "2026-08-01", registrado_por: elenaId },
  ]);
  if (errorPagos) throw errorPagos;

  const { error: errorBono } = await admin.from("bonos_cliente").insert({
    cliente_id: idLaura,
    plan_id: planBono.id,
    creditos_totales: 10,
    creditos_usados: 0,
    fecha_compra: "2026-04-02",
    activo: true,
  });
  if (errorBono) throw errorBono;

  console.log("Seed completado.");
  console.log(`Password para las 10 cuentas: ${DEMO_PASSWORD}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
```

- [ ] **Step 3: Run the seed script**

```bash
npm run seed
```

Expected: `Seed completado.` printed, exit code 0.

- [ ] **Step 4: Verify the data landed**

```bash
npx supabase db execute --sql "select (select count(*) from public.clientes) as clientes, (select count(*) from public.reservas) as reservas, (select count(*) from public.pagos) as pagos;"
```

Expected: `clientes=8, reservas=7, pagos=8`.

- [ ] **Step 5: Commit**

```bash
git add lib/demo-accounts.ts scripts/seed.ts
git commit -m "feat: add seed script for demo accounts and fixture data"
```

---

## Task 6: Integration tests (RPC + RLS) with Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/integration/setup.ts`
- Create: `tests/integration/helpers.ts`
- Create: `tests/integration/rpc-reservas.test.ts`
- Create: `tests/integration/rls.test.ts`

**Interfaces:**
- Consumes: `createAdminClient` (Task 4), `DEMO_PASSWORD` (Task 5), the seeded fixture (Task 5) — Maria/Laura/Sara/Ana on `clase-miercoles`, Ivan as entrenador.
- Produces: `anonClient()`, `signInAs(email)` from `tests/integration/helpers.ts`, reused by both test files.

- [ ] **Step 1: Write the Vitest config**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/integration/setup.ts"],
    testTimeout: 15000,
  },
});
```

- [ ] **Step 2: Write the env-loading setup file**

```ts
// tests/integration/setup.ts
import { config } from "dotenv";
config({ path: ".env.local" });
```

- [ ] **Step 3: Write the shared test helpers**

```ts
// tests/integration/helpers.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/database.types";
import { DEMO_PASSWORD } from "../../lib/demo-accounts";

export function anonClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export async function signInAs(email: string) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw error;
  return client;
}
```

- [ ] **Step 4: Write the RPC test — aforo lleno, bono sin créditos, promoción de lista de espera**

```ts
// tests/integration/rpc-reservas.test.ts
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
```

- [ ] **Step 5: Write the RLS test — cross-cliente denial, entrenador write denial**

```ts
// tests/integration/rls.test.ts
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
    const { error } = await ivan.from("clientes").insert({
      usuario_id: usuarioIvan!.id,
      plan_id: planMensual!.id,
      notas_rutina: "",
    });
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
```

- [ ] **Step 6: Run the integration tests**

```bash
npm run test:integration
```

Expected: all 6 tests pass (`4` in `rpc-reservas.test.ts`, `4` in `rls.test.ts` — recount: 4 + 4 = 8 total). If any fail, fix the migration/RLS policy causing it before moving on — don't proceed to app code with a broken data layer.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts tests/integration
git commit -m "test: add integration tests for reservation RPCs and RLS"
```

---

## Task 7: Middleware — session refresh + role-based routing

**Files:**
- Create: `middleware.ts` (project root, next to `next.config.ts`)

**Interfaces:**
- Consumes: `@supabase/ssr` `createServerClient`, `public.users.rol` (Task 1).
- Produces: redirects unauthenticated requests to `/login`; redirects authenticated requests away from `/` and `/login` to `/admin`, `/entrenador`, or `/cliente` based on `users.rol`; blocks a role from visiting another role's section.

- [ ] **Step 1: Write the middleware**

```ts
// middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const RUTAS_POR_ROL: Record<string, string> = {
  admin: "/admin",
  entrenador: "/entrenador",
  cliente: "/cliente",
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esRutaPublica = pathname === "/login";

  if (!user) {
    if (!esRutaPublica) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const { data: perfil } = await supabase.from("users").select("rol").eq("id", user.id).single();
  const rutaDelRol = perfil ? RUTAS_POR_ROL[perfil.rol] : null;

  if (!rutaDelRol) {
    return response;
  }

  if (pathname === "/" || pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = rutaDelRol;
    return NextResponse.redirect(url);
  }

  if (!pathname.startsWith(rutaDelRol)) {
    const url = request.nextUrl.clone();
    url.pathname = rutaDelRol;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors referencing `middleware.ts`.

(Full behavioral verification of the redirects happens manually in Task 13-15 once `/login` and the role sections exist — middleware alone can't be exercised meaningfully before those pages exist.)

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add auth middleware with role-based routing"
```

---

## Task 8: Login page — real form + demo quick-access panel

**Files:**
- Create: `app/login/page.tsx`

**Interfaces:**
- Consumes: `createClient()` (browser, Task 4), `DEMO_ACCOUNTS`/`DEMO_PASSWORD` (Task 5).

- [ ] **Step 1: Write the login page**

```tsx
// app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function entrarCon(emailEntrada: string, passwordEntrada: string) {
    setError(null);
    setCargando(true);
    const supabase = createClient();
    const { error: errorLogin } = await supabase.auth.signInWithPassword({
      email: emailEntrada,
      password: passwordEntrada,
    });
    setCargando(false);
    if (errorLogin) {
      setError("Email o contraseña incorrectos");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Elefitness</h1>
        <p className="text-muted-foreground">Inicia sesión</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email y contraseña</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button disabled={cargando} onClick={() => entrarCon(email, password)}>
            Entrar
          </Button>
        </CardContent>
      </Card>
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Acceso rápido (solo demo)</h2>
        <div className="grid gap-2">
          {DEMO_ACCOUNTS.map((cuenta) => (
            <Button
              key={cuenta.email}
              variant="outline"
              disabled={cargando}
              onClick={() => entrarCon(cuenta.email, DEMO_PASSWORD)}
            >
              {cuenta.nombre} · {cuenta.rol}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Run `npm run dev`, visit `http://localhost:3000/login`, click the "Elena · admin" quick-access button. Expected: redirected to `/admin` (via middleware, since Elena's role is admin) once Task 13 exists — for now, just confirm no console errors and that `supabase.auth.signInWithPassword` succeeds (check the Network tab for a 200 from `/auth/v1/token`).

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: add login page with real form and demo quick-access panel"
```

---

## Task 9: Data query layer

**Files:**
- Create: `lib/supabase/queries.ts`

**Interfaces:**
- Consumes: `createClient()` (server, Task 4), `Database` types (Task 1), existing `lib/types.ts` (unchanged).
- Produces: `obtenerClientes`, `obtenerUsuarios`, `obtenerPlanes`, `obtenerClases`, `obtenerReservas`, `obtenerPagos`, `obtenerBonosCliente`, `obtenerClienteDeUsuario(usuarioId)`, `obtenerOcupacionClases()` — all `async`, all return the exact camelCase shapes from `lib/types.ts`. Used by every Server Component page in Tasks 13-15.

- [ ] **Step 1: Write the query layer**

```ts
// lib/supabase/queries.ts
import { createClient } from "@/lib/supabase/server";
import type { Cliente, Usuario, Plan, Clase, Reserva, Pago, BonoCliente } from "@/lib/types";

export async function obtenerClientes(): Promise<Cliente[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("id, usuario_id, estado, plan_id, notas_rutina, created_at");
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    usuarioId: c.usuario_id,
    estado: c.estado,
    planId: c.plan_id,
    notasRutina: c.notas_rutina,
    createdAt: c.created_at,
  }));
}

export async function obtenerClienteDeUsuario(usuarioId: string): Promise<Cliente | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("id, usuario_id, estado, plan_id, notas_rutina, created_at")
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    usuarioId: data.usuario_id,
    estado: data.estado,
    planId: data.plan_id,
    notasRutina: data.notas_rutina,
    createdAt: data.created_at,
  };
}

export async function obtenerUsuarios(): Promise<Usuario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("users").select("id, email, rol, nombre, telefono");
  if (error) throw error;
  return (data ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    rol: u.rol,
    nombre: u.nombre,
    telefono: u.telefono,
  }));
}

export async function obtenerPlanes(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("planes").select("id, nombre, precio, tipo, clases_incluidas");
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    precio: p.precio,
    tipo: p.tipo,
    clasesIncluidas: p.clases_incluidas,
  }));
}

export async function obtenerClases(): Promise<Clase[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clases")
    .select("id, dia, hora_inicio, hora_fin, aforo_max, entrenador_id, recurrente");
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    dia: c.dia,
    horaInicio: c.hora_inicio.slice(0, 5),
    horaFin: c.hora_fin.slice(0, 5),
    aforoMax: c.aforo_max,
    entrenadorId: c.entrenador_id,
    recurrente: c.recurrente,
  }));
}

export async function obtenerReservas(): Promise<Reserva[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("reservas").select("id, clase_id, cliente_id, estado, created_at");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    claseId: r.clase_id,
    clienteId: r.cliente_id,
    estado: r.estado,
    createdAt: r.created_at,
  }));
}

export async function obtenerPagos(): Promise<Pago[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pagos")
    .select("id, cliente_id, plan_id, tipo, metodo, estado, importe, fecha_pago, ultimo_cobro, proximo_cobro, registrado_por");
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    clienteId: p.cliente_id,
    planId: p.plan_id,
    tipo: p.tipo,
    metodo: p.metodo,
    estado: p.estado,
    importe: p.importe,
    fechaPago: p.fecha_pago,
    ultimoCobro: p.ultimo_cobro,
    proximoCobro: p.proximo_cobro,
    registradoPor: p.registrado_por,
  }));
}

export async function obtenerBonosCliente(): Promise<BonoCliente[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bonos_cliente")
    .select("id, cliente_id, plan_id, creditos_totales, creditos_usados, fecha_compra, activo");
  if (error) throw error;
  return (data ?? []).map((b) => ({
    id: b.id,
    clienteId: b.cliente_id,
    planId: b.plan_id,
    creditosTotales: b.creditos_totales,
    creditosUsados: b.creditos_usados,
    fechaCompra: b.fecha_compra,
    activo: b.activo,
  }));
}

export async function obtenerOcupacionClases(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ocupacion_clases");
  if (error) throw error;
  const mapa: Record<string, number> = {};
  for (const fila of data ?? []) {
    mapa[fila.clase_id] = fila.confirmadas;
  }
  return mapa;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors referencing `lib/supabase/queries.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/queries.ts
git commit -m "feat: add data query layer mapping Supabase rows to app types"
```

---

## Task 10: Server Actions — clientes

**Files:**
- Create: `lib/actions/clientes.ts`

**Interfaces:**
- Consumes: `clienteFormSchema` (`lib/validaciones.ts`, unchanged), `createClient` (server, Task 4), `createAdminClient` (Task 4).
- Produces: `altaCliente(datos)`, `bajaCliente(clienteId)`, `reactivarCliente(clienteId)`, `actualizarCliente(clienteId, datos)` — all `async`, all return `{ error?: string }`. Used by `ClienteForm`/`ListaClientes` (Task 13).

- [ ] **Step 1: Write the Server Actions**

```ts
// lib/actions/clientes.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteFormSchema } from "@/lib/validaciones";

export async function altaCliente(datos: unknown): Promise<{ error?: string }> {
  const resultado = clienteFormSchema.safeParse(datos);
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { nombre, email, telefono, planId, notasRutina } = resultado.data;

  const supabase = await createClient();
  const {
    data: { user: admin },
  } = await supabase.auth.getUser();
  if (!admin) return { error: "No autenticado" };

  const adminClient = createAdminClient();
  const { data: nuevoAuthUser, error: errorAuth } = await adminClient.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
  });
  if (errorAuth || !nuevoAuthUser.user) {
    return { error: errorAuth?.message ?? "No se pudo crear la cuenta de la clienta" };
  }

  const { error: errorUsers } = await supabase.from("users").insert({
    id: nuevoAuthUser.user.id,
    email,
    rol: "cliente",
    nombre,
    telefono,
  });
  if (errorUsers) return { error: errorUsers.message };

  const { data: cliente, error: errorCliente } = await supabase
    .from("clientes")
    .insert({ usuario_id: nuevoAuthUser.user.id, plan_id: planId, notas_rutina: notasRutina })
    .select()
    .single();
  if (errorCliente || !cliente) return { error: errorCliente?.message ?? "No se pudo crear la clienta" };

  const { data: plan } = await supabase.from("planes").select("*").eq("id", planId).single();
  if (plan) {
    const fechaHoy = new Date().toISOString().slice(0, 10);
    await supabase.from("pagos").insert({
      cliente_id: cliente.id,
      plan_id: plan.id,
      tipo: plan.tipo,
      metodo: plan.tipo === "mensual" ? "stripe" : "efectivo",
      estado: "pendiente",
      importe: plan.precio,
      fecha_pago: fechaHoy,
      registrado_por: admin.id,
    });

    if (plan.tipo === "bono") {
      await supabase.from("bonos_cliente").insert({
        cliente_id: cliente.id,
        plan_id: plan.id,
        creditos_totales: plan.clases_incluidas ?? 0,
        creditos_usados: 0,
        fecha_compra: fechaHoy,
        activo: true,
      });
    }
  }

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/cobros");
  revalidatePath("/entrenador/clientes");
  revalidatePath("/entrenador/cobros");
  return {};
}

export async function bajaCliente(clienteId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update({ estado: "baja" }).eq("id", clienteId);
  if (error) return { error: error.message };
  revalidatePath("/admin/clientes");
  revalidatePath("/entrenador/clientes");
  return {};
}

export async function reactivarCliente(clienteId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update({ estado: "activo" }).eq("id", clienteId);
  if (error) return { error: error.message };
  revalidatePath("/admin/clientes");
  revalidatePath("/entrenador/clientes");
  return {};
}

export async function actualizarCliente(
  clienteId: string,
  datos: { planId: string; notasRutina: string }
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: clienteActual } = await supabase.from("clientes").select("plan_id").eq("id", clienteId).single();
  const cambiaPlan = Boolean(clienteActual) && datos.planId !== clienteActual!.plan_id;

  const { error } = await supabase
    .from("clientes")
    .update({ plan_id: datos.planId, notas_rutina: datos.notasRutina })
    .eq("id", clienteId);
  if (error) return { error: error.message };

  if (cambiaPlan) {
    const { data: nuevoPlan } = await supabase.from("planes").select("*").eq("id", datos.planId).single();
    if (nuevoPlan) {
      const { data: pagoExistente } = await supabase
        .from("pagos")
        .select("id")
        .eq("cliente_id", clienteId)
        .limit(1)
        .maybeSingle();
      if (pagoExistente) {
        await supabase
          .from("pagos")
          .update({ plan_id: nuevoPlan.id, tipo: nuevoPlan.tipo, importe: nuevoPlan.precio })
          .eq("id", pagoExistente.id);
      }

      const { data: bonoActivo } = await supabase
        .from("bonos_cliente")
        .select("id")
        .eq("cliente_id", clienteId)
        .eq("activo", true)
        .maybeSingle();

      if (nuevoPlan.tipo === "bono" && !bonoActivo) {
        await supabase.from("bonos_cliente").insert({
          cliente_id: clienteId,
          plan_id: nuevoPlan.id,
          creditos_totales: nuevoPlan.clases_incluidas ?? 0,
          creditos_usados: 0,
          fecha_compra: new Date().toISOString().slice(0, 10),
          activo: true,
        });
      } else if (nuevoPlan.tipo === "mensual" && bonoActivo) {
        await supabase.from("bonos_cliente").update({ activo: false }).eq("id", bonoActivo.id);
      }
    }
  }

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/cobros");
  revalidatePath("/entrenador/clientes");
  revalidatePath("/entrenador/cobros");
  return {};
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors referencing `lib/actions/clientes.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/clientes.ts
git commit -m "feat: add clientes Server Actions (alta, baja, reactivar, actualizar)"
```

---

## Task 11: Server Actions — reservas

**Files:**
- Create: `lib/actions/reservas.ts`

**Interfaces:**
- Consumes: `createClient` (server, Task 4), `reservar_clase`/`cancelar_reserva` RPCs (Task 3).
- Produces: `reservarClase(claseId, clienteId)`, `cancelarReserva(reservaId)` — both `async`, both return `{ error?: string }`. Used by `HorarioCliente` (Task 15).

- [ ] **Step 1: Write the Server Actions**

```ts
// lib/actions/reservas.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function traducirError(mensaje: string): string {
  if (mensaje.includes("creditos de bono")) return "No quedan créditos de bono disponibles";
  if (mensaje.includes("reserva activa")) return "Ya tienes una reserva activa para esta clase";
  if (mensaje.includes("no encontrad")) return "No se ha encontrado la clase o la reserva";
  if (mensaje.includes("cancelada")) return "Esa reserva ya estaba cancelada";
  if (mensaje.includes("No autorizado")) return "No tienes permiso para hacer esta acción";
  return "No se pudo completar la reserva";
}

export async function reservarClase(claseId: string, clienteId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reservar_clase", { p_clase_id: claseId, p_cliente_id: clienteId });
  if (error) return { error: traducirError(error.message) };

  revalidatePath("/cliente");
  revalidatePath("/admin/clases");
  revalidatePath("/entrenador/clases");
  return {};
}

export async function cancelarReserva(reservaId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancelar_reserva", { p_reserva_id: reservaId });
  if (error) return { error: traducirError(error.message) };

  revalidatePath("/cliente");
  revalidatePath("/admin/clases");
  revalidatePath("/entrenador/clases");
  return {};
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/actions/reservas.ts
git commit -m "feat: add reservas Server Actions calling reservar_clase/cancelar_reserva RPCs"
```

---

## Task 12: Server Actions — pagos

**Files:**
- Create: `lib/actions/pagos.ts`

**Interfaces:**
- Consumes: `createClient` (server, Task 4).
- Produces: `registrarPago(datos)` — `async`, returns `{ error?: string }`. Used by `TablaCobros` (Task 13).

- [ ] **Step 1: Write the Server Action**

```ts
// lib/actions/pagos.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const registrarPagoSchema = z.object({
  pagoId: z.string().min(1),
  fechaPago: z.string().min(1),
  proximoCobro: z.string().nullable(),
});

export async function registrarPago(datos: unknown): Promise<{ error?: string }> {
  const resultado = registrarPagoSchema.safeParse(datos);
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos invalidos" };
  }
  const { pagoId, fechaPago, proximoCobro } = resultado.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("pagos")
    .update({ estado: "al_dia", ultimo_cobro: fechaPago, proximo_cobro: proximoCobro, fecha_pago: fechaPago })
    .eq("id", pagoId);
  if (error) return { error: error.message };

  revalidatePath("/admin/cobros");
  revalidatePath("/entrenador/cobros");
  return {};
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/actions/pagos.ts
git commit -m "feat: add registrarPago Server Action"
```

---

## Task 13: Rewire the admin panel

**Files:**
- Create: `components/cerrar-sesion-button.tsx`
- Modify: `app/admin/layout.tsx`
- Modify: `app/admin/clientes/page.tsx`
- Modify: `app/admin/clases/page.tsx`
- Modify: `app/admin/cobros/page.tsx`
- Modify: `components/lista-clientes.tsx`
- Modify: `components/cliente-form.tsx`
- Modify: `components/calendario-semanal.tsx`
- Modify: `components/tabla-cobros.tsx`

**Interfaces:**
- Consumes: query functions (Task 9), Server Actions (Tasks 10-12).
- Produces: `<CerrarSesionButton />`, and prop-driven versions of `ListaClientes`, `ClienteForm`, `CalendarioSemanal`, `TablaCobros` reused verbatim by the entrenador panel in Task 14.

- [ ] **Step 1: Write the sign-out button**

```tsx
// components/cerrar-sesion-button.tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function CerrarSesionButton() {
  const router = useRouter();

  async function cerrarSesion() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={cerrarSesion}>
      Cerrar sesión
    </Button>
  );
}
```

- [ ] **Step 2: Rewrite the admin layout as a Server Component**

```tsx
// app/admin/layout.tsx
import Link from "next/link";
import { CerrarSesionButton } from "@/components/cerrar-sesion-button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between border-b pb-4">
        <nav className="flex gap-4 text-sm font-medium">
          <Link href="/admin/clientes">Clientes</Link>
          <Link href="/admin/clases">Clases</Link>
          <Link href="/admin/cobros">Cobros</Link>
        </nav>
        <CerrarSesionButton />
      </header>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `ListaClientes` to take props instead of `useAppStore`**

```tsx
// components/lista-clientes.tsx
"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { planPorId, usuarioPorId } from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";
import { ClienteForm } from "./cliente-form";
import { bajaCliente, reactivarCliente } from "@/lib/actions/clientes";
import type { Cliente, Usuario, Plan } from "@/lib/types";

interface Props {
  clientes: Cliente[];
  usuarios: Usuario[];
  planes: Plan[];
  soloLectura?: boolean;
}

export function ListaClientes({ clientes, usuarios, planes, soloLectura = false }: Props) {
  const [clienteEnEdicion, setClienteEnEdicion] = useState<Cliente | null>(null);
  const [creando, setCreando] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {!soloLectura && (
        <div className="flex justify-end">
          <Button onClick={() => setCreando(true)}>+ Nueva clienta</Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Notas de rutina</TableHead>
            {!soloLectura && <TableHead className="text-right">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.map((cliente) => {
            const usuario = usuarioPorId(usuarios, cliente.usuarioId);
            const plan = planPorId(planes, cliente.planId);
            if (!usuario) return null;
            return (
              <TableRow key={cliente.id}>
                <TableCell className="font-medium">{usuario.nombre}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {usuario.email}
                  <br />
                  {usuario.telefono}
                </TableCell>
                <TableCell>{plan?.nombre ?? "—"}</TableCell>
                <TableCell>
                  <BadgeEstado estado={cliente.estado} />
                </TableCell>
                <TableCell className="max-w-xs text-sm text-muted-foreground">{cliente.notasRutina || "—"}</TableCell>
                {!soloLectura && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setClienteEnEdicion(cliente)}>
                        Editar
                      </Button>
                      {cliente.estado === "activo" ? (
                        <Button variant="destructive" size="sm" onClick={() => bajaCliente(cliente.id)}>
                          Dar de baja
                        </Button>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => reactivarCliente(cliente.id)}>
                          Reactivar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {creando && <ClienteForm modo="crear" planes={planes} onCerrar={() => setCreando(false)} />}
      {clienteEnEdicion && (
        <ClienteForm
          modo="editar"
          cliente={clienteEnEdicion}
          usuario={usuarioPorId(usuarios, clienteEnEdicion.usuarioId)}
          planes={planes}
          onCerrar={() => setClienteEnEdicion(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `ClienteForm` to take props and call Server Actions**

```tsx
// components/cliente-form.tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clienteFormSchema } from "@/lib/validaciones";
import { altaCliente, actualizarCliente } from "@/lib/actions/clientes";
import type { Cliente, Usuario, Plan } from "@/lib/types";

interface Props {
  modo: "crear" | "editar";
  cliente?: Cliente;
  usuario?: Usuario;
  planes: Plan[];
  onCerrar: () => void;
}

export function ClienteForm({ modo, cliente, usuario, planes, onCerrar }: Props) {
  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [telefono, setTelefono] = useState(usuario?.telefono ?? "");
  const [planId, setPlanId] = useState(cliente?.planId ?? planes[0]?.id ?? "");
  const [notasRutina, setNotasRutina] = useState(cliente?.notasRutina ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const resultado = clienteFormSchema.safeParse({ nombre, email, telefono, planId, notasRutina });
    if (!resultado.success) {
      setError(resultado.error.issues[0]?.message ?? "Datos invalidos");
      return;
    }
    setGuardando(true);
    const respuesta =
      modo === "crear"
        ? await altaCliente(resultado.data)
        : await actualizarCliente(cliente!.id, { planId: resultado.data.planId, notasRutina: resultado.data.notasRutina });
    setGuardando(false);
    if (respuesta.error) {
      setError(respuesta.error);
      return;
    }
    onCerrar();
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{modo === "crear" ? "Nueva clienta" : "Editar clienta"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" value={nombre} disabled={modo === "editar"} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled={modo === "editar"} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="telefono">Telefono</Label>
            <Input id="telefono" value={telefono} disabled={modo === "editar"} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="plan">Plan</Label>
            <Select value={planId} onValueChange={(valor) => valor && setPlanId(valor)}>
              <SelectTrigger id="plan">
                <SelectValue placeholder="Selecciona un plan" />
              </SelectTrigger>
              <SelectContent>
                {planes.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="notas">Notas de rutina</Label>
            <Textarea id="notas" value={notasRutina} onChange={(e) => setNotasRutina(e.target.value)} rows={4} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Rewrite `CalendarioSemanal` to take props**

```tsx
// components/calendario-semanal.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ORDEN_DIAS, reservasConfirmadasDeClase, reservasListaEsperaDeClase, usuarioPorId, clientePorId } from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";
import type { Clase, Reserva, Cliente, Usuario } from "@/lib/types";

const ETIQUETA_DIA: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miercoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sabado",
  domingo: "Domingo",
};

interface Props {
  clases: Clase[];
  reservas: Reserva[];
  clientes: Cliente[];
  usuarios: Usuario[];
}

export function CalendarioSemanal({ clases, reservas, clientes, usuarios }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {ORDEN_DIAS.map((dia) => {
        const clasesDelDia = clases.filter((c) => c.dia === dia);
        if (clasesDelDia.length === 0) return null;
        return (
          <div key={dia} className="flex flex-col gap-3">
            <h3 className="font-medium">{ETIQUETA_DIA[dia]}</h3>
            {clasesDelDia.map((clase) => {
              const confirmadas = reservasConfirmadasDeClase(reservas, clase.id);
              const enEspera = reservasListaEsperaDeClase(reservas, clase.id);
              const entrenador = usuarioPorId(usuarios, clase.entrenadorId);
              return (
                <Card key={clase.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {clase.horaInicio} - {clase.horaFin}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {entrenador?.nombre} · {confirmadas.length}/{clase.aforoMax} plazas
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm">
                    {[...confirmadas, ...enEspera].map((reserva) => {
                      const cliente = clientePorId(clientes, reserva.clienteId);
                      const usuario = cliente ? usuarioPorId(usuarios, cliente.usuarioId) : undefined;
                      return (
                        <div key={reserva.id} className="flex items-center justify-between">
                          <span>{usuario?.nombre ?? "—"}</span>
                          <BadgeEstado estado={reserva.estado} />
                        </div>
                      );
                    })}
                    {confirmadas.length === 0 && enEspera.length === 0 && (
                      <p className="text-muted-foreground">Sin reservas todavia</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Rewrite `TablaCobros` to take props and add a "marcar como pagado" action**

```tsx
// components/tabla-cobros.tsx
"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { usuarioPorId, clientePorId, planPorId } from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";
import { registrarPago } from "@/lib/actions/pagos";
import type { Pago, Cliente, Usuario, Plan } from "@/lib/types";

interface Props {
  pagos: Pago[];
  clientes: Cliente[];
  usuarios: Usuario[];
  planes: Plan[];
  soloLectura?: boolean;
}

export function TablaCobros({ pagos, clientes, usuarios, planes, soloLectura = false }: Props) {
  const [procesando, setProcesando] = useState<string | null>(null);

  async function marcarComoPagado(pago: Pago) {
    setProcesando(pago.id);
    const fechaHoy = new Date().toISOString().slice(0, 10);
    const proximoCobro =
      pago.tipo === "mensual"
        ? new Date(new Date(fechaHoy).setMonth(new Date(fechaHoy).getMonth() + 1)).toISOString().slice(0, 10)
        : null;
    await registrarPago({ pagoId: pago.id, fechaPago: fechaHoy, proximoCobro });
    setProcesando(null);
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Clienta</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Metodo</TableHead>
          <TableHead>Importe</TableHead>
          <TableHead>Ultimo cobro</TableHead>
          <TableHead>Proximo cobro</TableHead>
          <TableHead>Estado</TableHead>
          {!soloLectura && <TableHead className="text-right">Acciones</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {pagos.map((pago) => {
          const cliente = clientePorId(clientes, pago.clienteId);
          const usuario = cliente ? usuarioPorId(usuarios, cliente.usuarioId) : undefined;
          const plan = planPorId(planes, pago.planId);
          return (
            <TableRow key={pago.id}>
              <TableCell className="font-medium">{usuario?.nombre ?? "—"}</TableCell>
              <TableCell>{plan?.nombre ?? "—"}</TableCell>
              <TableCell className="capitalize">{pago.metodo}</TableCell>
              <TableCell>{pago.importe.toFixed(2)} €</TableCell>
              <TableCell>{pago.ultimoCobro ?? "—"}</TableCell>
              <TableCell>{pago.proximoCobro ?? "—"}</TableCell>
              <TableCell>
                <BadgeEstado estado={pago.estado} />
              </TableCell>
              {!soloLectura && (
                <TableCell className="text-right">
                  {pago.estado !== "al_dia" && (
                    <Button size="sm" disabled={procesando === pago.id} onClick={() => marcarComoPagado(pago)}>
                      Marcar como pagado hoy
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 7: Rewrite the three admin pages as Server Components**

```tsx
// app/admin/clientes/page.tsx
import { ListaClientes } from "@/components/lista-clientes";
import { obtenerClientes, obtenerUsuarios, obtenerPlanes } from "@/lib/supabase/queries";

export default async function AdminClientesPage() {
  const [clientes, usuarios, planes] = await Promise.all([obtenerClientes(), obtenerUsuarios(), obtenerPlanes()]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Clientes</h1>
      <ListaClientes clientes={clientes} usuarios={usuarios} planes={planes} />
    </div>
  );
}
```

```tsx
// app/admin/clases/page.tsx
import { CalendarioSemanal } from "@/components/calendario-semanal";
import { obtenerClases, obtenerReservas, obtenerClientes, obtenerUsuarios } from "@/lib/supabase/queries";

export default async function AdminClasesPage() {
  const [clases, reservas, clientes, usuarios] = await Promise.all([
    obtenerClases(),
    obtenerReservas(),
    obtenerClientes(),
    obtenerUsuarios(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Clases</h1>
      <CalendarioSemanal clases={clases} reservas={reservas} clientes={clientes} usuarios={usuarios} />
    </div>
  );
}
```

```tsx
// app/admin/cobros/page.tsx
import { TablaCobros } from "@/components/tabla-cobros";
import { obtenerPagos, obtenerClientes, obtenerUsuarios, obtenerPlanes } from "@/lib/supabase/queries";

export default async function AdminCobrosPage() {
  const [pagos, clientes, usuarios, planes] = await Promise.all([
    obtenerPagos(),
    obtenerClientes(),
    obtenerUsuarios(),
    obtenerPlanes(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Cobros</h1>
      <TablaCobros pagos={pagos} clientes={clientes} usuarios={usuarios} planes={planes} />
    </div>
  );
}
```

`app/admin/page.tsx` (the `redirect("/admin/clientes")` index route) stays unchanged.

- [ ] **Step 8: Manual verification**

This step needs Task 15 (root layout cleanup, so `AppStoreProvider` no longer wraps a tree that no longer needs it) to fully work end-to-end, so full click-through happens at the end of Task 16. For now just run:

```bash
npx tsc --noEmit
```

Expected: no type errors in any file touched in this task.

- [ ] **Step 9: Commit**

```bash
git add components/cerrar-sesion-button.tsx app/admin components/lista-clientes.tsx components/cliente-form.tsx components/calendario-semanal.tsx components/tabla-cobros.tsx
git commit -m "feat: rewire admin panel to Supabase Server Components and Server Actions"
```

---

## Task 14: Rewire the entrenador panel (read-only, reuses Task 13's components)

**Files:**
- Modify: `app/entrenador/layout.tsx`
- Modify: `app/entrenador/clientes/page.tsx`
- Modify: `app/entrenador/clases/page.tsx`
- Modify: `app/entrenador/cobros/page.tsx`

**Interfaces:**
- Consumes: `ListaClientes`, `CalendarioSemanal`, `TablaCobros` (Task 13), query functions (Task 9).

- [ ] **Step 1: Rewrite the entrenador layout as a Server Component**

```tsx
// app/entrenador/layout.tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CerrarSesionButton } from "@/components/cerrar-sesion-button";

export default function EntrenadorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between border-b pb-4">
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/entrenador/clientes">Clientes</Link>
          <Link href="/entrenador/clases">Clases</Link>
          <Link href="/entrenador/cobros">Cobros</Link>
          <Badge variant="outline">Solo lectura</Badge>
        </nav>
        <CerrarSesionButton />
      </header>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the three entrenador pages as Server Components**

```tsx
// app/entrenador/clientes/page.tsx
import { ListaClientes } from "@/components/lista-clientes";
import { obtenerClientes, obtenerUsuarios, obtenerPlanes } from "@/lib/supabase/queries";

export default async function EntrenadorClientesPage() {
  const [clientes, usuarios, planes] = await Promise.all([obtenerClientes(), obtenerUsuarios(), obtenerPlanes()]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Clientes</h1>
      <ListaClientes clientes={clientes} usuarios={usuarios} planes={planes} soloLectura />
    </div>
  );
}
```

```tsx
// app/entrenador/clases/page.tsx
import { CalendarioSemanal } from "@/components/calendario-semanal";
import { obtenerClases, obtenerReservas, obtenerClientes, obtenerUsuarios } from "@/lib/supabase/queries";

export default async function EntrenadorClasesPage() {
  const [clases, reservas, clientes, usuarios] = await Promise.all([
    obtenerClases(),
    obtenerReservas(),
    obtenerClientes(),
    obtenerUsuarios(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Clases</h1>
      <CalendarioSemanal clases={clases} reservas={reservas} clientes={clientes} usuarios={usuarios} />
    </div>
  );
}
```

```tsx
// app/entrenador/cobros/page.tsx
import { TablaCobros } from "@/components/tabla-cobros";
import { obtenerPagos, obtenerClientes, obtenerUsuarios, obtenerPlanes } from "@/lib/supabase/queries";

export default async function EntrenadorCobrosPage() {
  const [pagos, clientes, usuarios, planes] = await Promise.all([
    obtenerPagos(),
    obtenerClientes(),
    obtenerUsuarios(),
    obtenerPlanes(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Cobros</h1>
      <TablaCobros pagos={pagos} clientes={clientes} usuarios={usuarios} planes={planes} soloLectura />
    </div>
  );
}
```

`app/entrenador/page.tsx` (the `redirect("/entrenador/clases")` index route) stays unchanged.

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/entrenador
git commit -m "feat: rewire entrenador panel to Supabase Server Components"
```

---

## Task 15: Rewire the cliente panel

**Files:**
- Modify: `app/cliente/layout.tsx`
- Modify: `app/cliente/page.tsx`
- Modify: `components/horario-cliente.tsx`
- Modify: `components/mi-plan.tsx`

**Interfaces:**
- Consumes: query functions (Task 9, including `obtenerOcupacionClases`), `reservarClase`/`cancelarReserva` (Task 11).

- [ ] **Step 1: Rewrite the cliente layout as a Server Component**

```tsx
// app/cliente/layout.tsx
import { CerrarSesionButton } from "@/components/cerrar-sesion-button";

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-end border-b pb-4">
        <CerrarSesionButton />
      </header>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `HorarioCliente` to take props and call Server Actions via `useTransition`**

```tsx
// components/horario-cliente.tsx
"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ORDEN_DIAS, reservaActivaDeClienteEnClase } from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";
import { reservarClase, cancelarReserva } from "@/lib/actions/reservas";
import type { Clase, Reserva } from "@/lib/types";

const ETIQUETA_DIA: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miercoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sabado",
  domingo: "Domingo",
};

interface Props {
  clienteId: string;
  clases: Clase[];
  reservas: Reserva[];
  ocupacion: Record<string, number>;
}

export function HorarioCliente({ clienteId, clases, reservas, ocupacion }: Props) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reservar(claseId: string) {
    setError(null);
    startTransition(async () => {
      const respuesta = await reservarClase(claseId, clienteId);
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

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ORDEN_DIAS.map((dia) => {
          const clasesDelDia = clases.filter((c) => c.dia === dia);
          if (clasesDelDia.length === 0) return null;
          return (
            <div key={dia} className="flex flex-col gap-3">
              <h3 className="font-medium">{ETIQUETA_DIA[dia]}</h3>
              {clasesDelDia.map((clase) => {
                const libres = clase.aforoMax - (ocupacion[clase.id] ?? 0);
                const miReserva = reservaActivaDeClienteEnClase(reservas, clienteId, clase.id);
                return (
                  <Card key={clase.id}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {clase.horaInicio} - {clase.horaFin}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{Math.max(libres, 0)} plazas libres de {clase.aforoMax}</p>
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
                        <Button size="sm" disabled={pendiente} onClick={() => reservar(clase.id)}>
                          {libres > 0 ? "Reservar" : "Unirse a lista de espera"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `MiPlan` to take props**

```tsx
// components/mi-plan.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { planPorId, pagoDeCliente, bonoDeCliente, creditosRestantes } from "@/lib/selectors";
import { BadgeEstado } from "./badge-estado";
import type { Cliente, Plan, Pago, BonoCliente } from "@/lib/types";

interface Props {
  cliente: Cliente;
  planes: Plan[];
  pagos: Pago[];
  bonosCliente: BonoCliente[];
}

export function MiPlan({ cliente, planes, pagos, bonosCliente }: Props) {
  const plan = planPorId(planes, cliente.planId);
  const pago = pagoDeCliente(pagos, cliente.id);
  const bono = bonoDeCliente(bonosCliente, cliente.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mi plan</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p>
          <span className="text-muted-foreground">Plan: </span>
          {plan?.nombre ?? "—"}
        </p>
        {bono && (
          <p>
            <span className="text-muted-foreground">Creditos restantes: </span>
            {creditosRestantes(bono)} de {bono.creditosTotales}
          </p>
        )}
        {pago && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Estado de pago: </span>
            <BadgeEstado estado={pago.estado} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Rewrite the cliente page as a Server Component**

```tsx
// app/cliente/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HorarioCliente } from "@/components/horario-cliente";
import { MiPlan } from "@/components/mi-plan";
import {
  obtenerClienteDeUsuario,
  obtenerUsuarios,
  obtenerClases,
  obtenerReservas,
  obtenerPlanes,
  obtenerPagos,
  obtenerBonosCliente,
  obtenerOcupacionClases,
} from "@/lib/supabase/queries";
import { usuarioPorId } from "@/lib/selectors";

export default async function ClientePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [cliente, usuarios, clases, reservas, planes, pagos, bonosCliente, ocupacion] = await Promise.all([
    obtenerClienteDeUsuario(user.id),
    obtenerUsuarios(),
    obtenerClases(),
    obtenerReservas(),
    obtenerPlanes(),
    obtenerPagos(),
    obtenerBonosCliente(),
    obtenerOcupacionClases(),
  ]);

  if (!cliente) redirect("/login");
  const usuario = usuarioPorId(usuarios, user.id);
  if (!usuario) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Hola, {usuario.nombre}</h1>
      <MiPlan cliente={cliente} planes={planes} pagos={pagos} bonosCliente={bonosCliente} />
      <div>
        <h2 className="mb-3 text-lg font-medium">Horario semanal</h2>
        <HorarioCliente clienteId={cliente.id} clases={clases} reservas={reservas} ocupacion={ocupacion} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify it compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add app/cliente components/horario-cliente.tsx components/mi-plan.tsx
git commit -m "feat: rewire cliente panel to Supabase Server Components"
```

---

## Task 16: Cleanup — remove the mock layer, update root layout and home page

**Files:**
- Delete: `lib/mock-store.tsx`
- Delete: `lib/mock-data.ts`
- Delete: `components/rol-selector.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: nothing new — this is the point where nothing in the app still imports the mock layer.

- [ ] **Step 1: Confirm nothing still imports the mock layer**

```bash
grep -rl "mock-store\|mock-data\|rol-selector" app components lib --include="*.ts" --include="*.tsx"
```

Expected: no output (the only remaining reference should be `README.md`, which Task 17 updates). If any `app`/`components`/`lib` file still shows up, go back and finish rewiring it before deleting anything.

- [ ] **Step 2: Delete the mock files**

```bash
rm lib/mock-store.tsx lib/mock-data.ts components/rol-selector.tsx
```

- [ ] **Step 3: Simplify the root layout**

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Elefitness",
  description: "Panel del centro de entrenamiento",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Make the home page a safety-net redirect**

Middleware already redirects `/` based on session (Task 7), so this only fires if middleware is ever bypassed:

```tsx
// app/page.tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/login");
}
```

- [ ] **Step 5: Verify the build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed with no errors.

- [ ] **Step 6: Full manual click-through**

```bash
npm run dev
```

Walk through, for each of the 5 demo accounts (`http://localhost:3000/login` → quick-access buttons):
- **Elena (admin):** `/admin/clientes` shows 8 clientas; create a new one (alta); edit Maria's notas; dar de baja and reactivar a clienta; `/admin/clases` shows lunes (1/5) and miercoles (5/5 + Laura en lista de espera); `/admin/cobros` shows 8 pagos, Sara "Moroso" with a "Marcar como pagado hoy" button that flips her to "Al dia".
- **Ivan (entrenador):** same three sections, no "Nueva clienta" button, no baja/reactivar buttons, no "Marcar como pagado" button — everything read-only.
- **Maria (cliente, mensual):** `/cliente` shows her plan, lunes shows "Cancelar" (she has a confirmed reserva), other days show "Reservar".
- **Laura (cliente, bono):** shows "Creditos restantes: 0 de 10" (all consumed by the seed... actually she's in lista_espera so 0 used — confirm this matches the seed), miercoles shows her lista_espera badge with "Cancelar".
- **Sara (cliente, moroso):** shows "Estado de pago: Moroso"; reserving lunes should work (plan mensual has no credit limit).

Expected: no console errors, no broken redirects, every action reflected after a page refresh.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove mock data layer, simplify root layout and home page"
```

---

## Task 17: Update README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing — documentation only.

- [ ] **Step 1: Rewrite the README to describe the real-backend setup**

Replace the current mock-demo description with:

```markdown
# Elefitness

Panel del centro de entrenamiento grupal: reservas de clase con aforo,
pagos, clientes. Backend real sobre Supabase (Postgres + Auth + RLS).

## Que es y que no es

- Los datos viven en un proyecto Supabase real (`pdvpruktssojuicwhhlt`),
  no en memoria — se conservan entre recargas y despliegues.
- Login real con Supabase Auth. `/login` tiene un formulario de
  email/contraseña y un panel de "Acceso rápido (solo demo)" con las 5
  cuentas semilla (Elena, Ivan, Maria, Laura, Sara) para cambiar de rol
  rápido en una demo.
- No hay Stripe checkout, Resend ni PWA todavia — eso es Sprint 3/4 real,
  descrito en `Claude.MD` y `docs/superpowers/specs/2026-07-31-sprint1-supabase-design.md`.

## Correr en local

```bash
npm install
cp .env.local.example .env.local   # si no existe ya .env.local con las credenciales de Supabase
npm run seed                        # solo la primera vez, contra un proyecto Supabase vacio
npm run dev
```

Abre `http://localhost:3000` — redirige a `/login`.

## Tests de integración

Corren contra el proyecto Supabase real (no mocks), usando las cuentas
semilla creadas por `npm run seed`:

```bash
npm run test:integration
```

## Desplegar en Vercel

```bash
npx vercel login
npx vercel --prod
```

En la configuración de Vercel, añade las env vars `NEXT_PUBLIC_SUPABASE_URL`
y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **No** subas `SUPABASE_SERVICE_ROLE_KEY`
a Vercel — se usa solo en local para `npm run seed`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for real Supabase backend"
```

---

## After this plan

Once all 17 tasks are verified (Task 16's manual click-through passing, `npm run test:integration` green, `npm run build` green), tell Germán it's ready to show Elena — do not check off Sprint 1/2 boxes in `CLAUDE.md` until he confirms she's seen it working, per the spec's constraint.
