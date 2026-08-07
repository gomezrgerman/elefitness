# Reglas de Negocio v1 (capa de datos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el esquema de Supabase y la capa de datos (RPCs, RLS, server actions, seed, tests) de Elefitness para soportar las reglas de negocio de **Fase 1** confirmadas en la reunión con Elena del 2026-08-05 y fijadas en la propuesta comercial del mismo día: sesiones con fecha concreta, copiar horario semanal, cancelación 24h con bono de recuperación, asistencia y deuda, y aforo con tope oculto.

**Architecture:** El cambio central es introducir una tabla `sesiones` (una ocurrencia con fecha concreta de una `clase`-plantilla). `reservas` pasa a colgar de `sesion_id` en vez de `clase_id`. Las reglas nuevas (24h → bono de recuperación, deuda por falta, tope mensual de recuperación, aforo oculto) viven como lógica `SECURITY DEFINER` en las RPCs de Postgres, siguiendo el patrón ya establecido en `reservar_clase`/`cancelar_reserva` (autorización dentro de la función, no vía policies de escritura). La capa TypeScript (`lib/types.ts`, `lib/supabase/queries.ts`, `lib/selectors.ts`, `lib/actions/*`) se actualiza para reflejar el nuevo esquema.

**Tech Stack:** Next.js 15 Server Actions, Supabase Postgres (RLS + PL/pgSQL RPCs, `SECURITY DEFINER`), Zod, Vitest (tests de integración contra el proyecto Supabase real, sin mocks).

## Global Constraints

- Toda RPC nueva es `security definer`, con `set search_path = public`, `revoke all ... from public`, `grant execute ... to authenticated` — igual que `reservar_clase`/`cancelar_reserva`/`ocupacion_clases` existentes.
- Autorización dentro del cuerpo de la función (patrón `v_autorizado`: dueño de la fila O `auth_rol() = 'admin'`), no policies de INSERT/UPDATE para `cliente` — igual que hoy.
- Nombres de policy RLS: `"{tabla}_{rol}_{alcance}"` (ej. `sesiones_admin_all`). Admin siempre `for all using/with check (auth_rol()='admin')`. Entrenador siempre `for select` a nivel de **policies de tabla** (nunca INSERT/UPDATE por RLS). Cliente siempre `for select` acotado a su propia fila.
- **`marcar_asistencia` acepta admin O entrenador** — confirmado: Iván marca asistencia en vivo desde su panel (así lo dice la propuesta comercial del 2026-08-05, ya se lo prometió a Elena). Sigue sin policy de UPDATE para `entrenador` en la tabla `reservas` — la escritura pasa exclusivamente por la RPC, que hace su propia comprobación de rol, igual que el patrón ya usado para que un cliente reserve/cancele sin policies de escritura. `crear_bono` sigue siendo **admin-only** (alta/compra de bono, dinero real — no forma parte de lo que se le prometió a Iván).
- Server actions: `"use server"`, validación con Zod cuando el input viene de un formulario, retorno siempre `Promise<{ error?: string }>`, `revalidatePath(...)` de cada panel afectado (`/admin/...`, `/entrenador/...`, `/cliente`).
- Nombres de tabla/campo en español, camelCase en la capa TS (`lib/types.ts`), snake_case en Postgres — `lib/supabase/queries.ts` hace el mapeo.
- No se migran datos de producción: el proyecto no tiene clientas reales todavía, solo datos de seed. Las migraciones que cambian la forma de `reservas` truncan en vez de intentar preservar filas antiguas — hay que volver a correr `npm run seed` después de aplicarlas.
- **Alcance de este plan: solo capa de datos, y solo Fase 1** tal y como quedó fijada en la propuesta comercial del 2026-08-05 (2.000€ + IVA). **Etiquetas de cliente/acceso a clases y bloqueo manual de clases/grupos quedan fuera a propósito** — la propuesta los vende como Fase 2 ("a definir", opcional), así que no se construyen todavía aunque salieran en la reunión original; ver `brief-app-centro-entrenamiento.md` sección 7 para el detalle. UI de calendario con 3 vistas, panel de gestión, y ocultar el aforo exacto en pantalla también quedan fuera — son un plan de UI posterior.

---

## File Structure

```
supabase/migrations/
  0006_reglas_negocio_schema.sql   (nuevo) — sesiones, reservas restructure, deuda, bonos tipo/caducidad
  0007_reservas_historial.sql      (nuevo) — reservas_historial + trigger + RLS
  0008_rpc_reglas_negocio.sql      (nuevo) — reservar_sesion, cancelar_reserva, crear_bono, marcar_asistencia, ocupacion_sesiones, copiar_semana

lib/database.types.ts   (regenerado, no se edita a mano)
lib/types.ts             (modificado) — Sesion, tipos actualizados
lib/supabase/queries.ts  (modificado) — obtenerSesiones, obtenerOcupacionSesiones, etc.
lib/selectors.ts         (modificado) — helpers sesion-scoped
lib/actions/reservas.ts  (modificado) — reservarSesion
lib/actions/asistencia.ts (nuevo) — marcarAsistencia
lib/actions/bonos.ts      (nuevo) — crearBono
lib/actions/horarios.ts   (nuevo) — copiarSemana
lib/actions/clientes.ts   (modificado) — usa crearBono en vez de insert directo

scripts/seed.ts (modificado) — sesiones con fecha, dias_semana_habituales

tests/integration/rpc-reservas.test.ts    (modificado) — adaptado a sesion_id
tests/integration/rpc-authz.test.ts       (modificado) — adaptado a sesion_id
tests/integration/rpc-bonos.test.ts       (nuevo)
tests/integration/rpc-asistencia.test.ts  (nuevo)
tests/integration/rpc-copiar-semana.test.ts (nuevo)
```

---

### Task 1: Migración 0006 — esquema base (sesiones, deuda, bonos con tipo/caducidad)

**Files:**
- Create: `supabase/migrations/0006_reglas_negocio_schema.sql`

**Interfaces:**
- Produces: tabla `public.sesiones(id, clase_id, fecha, aforo_efectivo, created_at)`; `public.reservas` sin `clase_id`, con `sesion_id uuid not null`, `asistencia estado_asistencia_enum`, `cancelada_en timestamptz`; `public.clientes.dias_semana_habituales integer`, `public.clientes.deuda_creditos integer`; `public.bonos_cliente.tipo tipo_bono_enum`, `public.bonos_cliente.fecha_caducidad date`, `plan_id` ahora nullable. Enums `tipo_bono_enum`, `estado_asistencia_enum`.

- [ ] **Step 1: Escribir la migración**

```sql
-- 0006_reglas_negocio_schema.sql
-- Restructura el modelo para soportar sesiones con fecha concreta (en vez de
-- solo plantilla semanal), asistencia por sesion, deuda por falta, y bonos con
-- caducidad y tipo (normal / recuperacion). Ver brief-app-centro-entrenamiento.md
-- seccion 7 (reunion 2026-08-05) y la propuesta comercial del mismo dia para el
-- porque de cada regla y que queda en Fase 1 vs Fase 2 (etiquetas y bloqueo
-- manual de clases quedan fuera, son Fase 2).

create type tipo_bono_enum as enum ('normal', 'recuperacion');
create type estado_asistencia_enum as enum ('pendiente', 'asistio', 'no_asistio');

-- sesiones = una ocurrencia concreta de una clase en una fecha. Se generan via
-- la RPC copiar_semana o manualmente por el admin. aforo_efectivo permite a
-- Elena bajar el aforo real de un dia concreto sin que el cliente vea que
-- existe ese limite (para el cliente sigue siendo solo "Libre"/"Completo").
create table public.sesiones (
  id uuid primary key default gen_random_uuid(),
  clase_id uuid not null references public.clases(id) on delete cascade,
  fecha date not null,
  aforo_efectivo integer,
  created_at timestamptz not null default now(),
  unique (clase_id, fecha)
);

alter table public.sesiones enable row level security;
create policy "sesiones_admin_all" on public.sesiones for all to authenticated
  using (public.auth_rol() = 'admin') with check (public.auth_rol() = 'admin');
create policy "sesiones_entrenador_select" on public.sesiones for select to authenticated
  using (public.auth_rol() = 'entrenador');
create policy "sesiones_cliente_select" on public.sesiones for select to authenticated
  using (public.auth_rol() = 'cliente');

-- reservas pasa a colgar de una sesion concreta, no de la clase-plantilla. No
-- hay reservas reales en produccion todavia (solo datos de seed), asi que se
-- trunca en vez de migrar filas antiguas a sesiones sinteticas.
truncate table public.reservas;
drop index if exists public.reservas_activa_unica_idx;
alter table public.reservas drop column clase_id;
alter table public.reservas add column sesion_id uuid not null references public.sesiones(id) on delete cascade;
alter table public.reservas add column asistencia estado_asistencia_enum not null default 'pendiente';
alter table public.reservas add column cancelada_en timestamptz;
create unique index reservas_activa_unica_idx on public.reservas (sesion_id, cliente_id) where estado <> 'cancelada';

-- dias_semana_habituales alimenta el tope mensual de bonos de recuperacion
-- (1/mes si 1-2 dias, 2/mes si 3+); deuda_creditos es el contador de sesiones
-- falladas sin cancelar a tiempo, pendiente de descontar del proximo bono.
alter table public.clientes add column dias_semana_habituales integer not null default 1;
alter table public.clientes add column deuda_creditos integer not null default 0;

-- tipo distingue un bono normal (comprado, caduca a los 3 meses) de un bono de
-- recuperacion (generado por una cancelacion con 24h+ de antelacion, caduca a
-- las 2 semanas). plan_id pasa a ser opcional porque un bono de recuperacion
-- no esta ligado a la compra de un plan.
alter table public.bonos_cliente add column tipo tipo_bono_enum not null default 'normal';
alter table public.bonos_cliente add column fecha_caducidad date;
alter table public.bonos_cliente alter column plan_id drop not null;

-- reservar_clase/ocupacion_clases quedan invalidas al desaparecer
-- reservas.clase_id; se recrean como reservar_sesion/ocupacion_sesiones en
-- 0008_rpc_reglas_negocio.sql (necesita el historial de 0007 primero).
drop function if exists public.reservar_clase(uuid, uuid);
drop function if exists public.ocupacion_clases();
```

- [ ] **Step 2: Aplicar la migración**

Run: `supabase db push`
Expected: aplica `0006_reglas_negocio_schema.sql` sin errores. La app dejará de poder reservar/cancelar hasta el Task 3 (esperado, forma parte de esta migración conjunta).

- [ ] **Step 3: Comprobación rápida del esquema**

Run (SQL editor de Supabase o `psql`): `select column_name from information_schema.columns where table_name = 'reservas';`
Expected: la lista incluye `sesion_id`, `asistencia`, `cancelada_en` y **no** incluye `clase_id`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0006_reglas_negocio_schema.sql
git commit -m "feat: add sesiones table and restructure reservas/bonos for v1 business rules"
```

---

### Task 2: Migración 0007 — historial de reservas

**Files:**
- Create: `supabase/migrations/0007_reservas_historial.sql`

**Interfaces:**
- Consumes: `public.reservas` (Task 1).
- Produces: `public.reservas_historial(id, reserva_id, sesion_id, cliente_id, evento, creado_en)`, trigger `reservas_historial_trigger` que la rellena automáticamente en cada INSERT/UPDATE de `reservas`.

- [ ] **Step 1: Escribir la migración**

```sql
-- 0007_reservas_historial.sql
-- Historial de movimientos por sesion (quien se ha apuntado, desapuntado, ha
-- sido promovido desde lista de espera, o ha fallado/asistido), para que la
-- ficha de la clase muestre el registro completo y no solo el estado actual.
create table public.reservas_historial (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  sesion_id uuid not null,
  cliente_id uuid not null,
  evento text not null,
  creado_en timestamptz not null default now()
);

alter table public.reservas_historial enable row level security;
create policy "reservas_historial_admin_all" on public.reservas_historial for all to authenticated
  using (public.auth_rol() = 'admin') with check (public.auth_rol() = 'admin');
create policy "reservas_historial_entrenador_select" on public.reservas_historial for select to authenticated
  using (public.auth_rol() = 'entrenador');
create policy "reservas_historial_cliente_select_own" on public.reservas_historial for select to authenticated
  using (exists (select 1 from public.clientes c where c.id = reservas_historial.cliente_id and c.usuario_id = auth.uid()));

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

  if new.asistencia <> old.asistencia and new.asistencia <> 'pendiente' then
    insert into public.reservas_historial (reserva_id, sesion_id, cliente_id, evento)
    values (new.id, new.sesion_id, new.cliente_id, new.asistencia::text);
  end if;

  return new;
end;
$$;

create trigger reservas_historial_trigger
after insert or update on public.reservas
for each row execute function public.registrar_historial_reserva();
```

- [ ] **Step 2: Aplicar y comprobar**

Run: `supabase db push`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_reservas_historial.sql
git commit -m "feat: add reservas_historial audit trail via trigger"
```

---

### Task 3: Migración 0008 — RPCs (reservar_sesion, cancelar_reserva, crear_bono, marcar_asistencia, ocupacion_sesiones, copiar_semana)

**Files:**
- Create: `supabase/migrations/0008_rpc_reglas_negocio.sql`

**Interfaces:**
- Consumes: `sesiones` (Task 1), `reservas_historial` trigger (Task 2, dispara solo, no se llama a mano).
- Produces:
  - `reservar_sesion(p_sesion_id uuid, p_cliente_id uuid) returns reservas`
  - `cancelar_reserva(p_reserva_id uuid) returns reservas` (redefinida)
  - `crear_bono(p_cliente_id uuid, p_plan_id uuid, p_creditos_totales integer, p_fecha_compra date, p_tipo tipo_bono_enum default 'normal') returns bonos_cliente`
  - `marcar_asistencia(p_reserva_id uuid, p_asistio boolean) returns reservas`
  - `ocupacion_sesiones() returns table(sesion_id uuid, confirmadas integer)`
  - `copiar_semana(p_fecha_origen date, p_fecha_destino date) returns integer`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0008_rpc_reglas_negocio.sql
-- RPCs de la capa de reservas sobre el nuevo modelo de sesiones: reservar y
-- cancelar ahora validan ventana de 3 semanas y caducidad de bonos;
-- cancelar_reserva emite un bono de recuperacion si se cancela con 24h+ de
-- antelacion (respetando el tope mensual); se anaden crear_bono (compra/alta
-- de bono, aplica deuda pendiente, admin-only), marcar_asistencia (admin O
-- entrenador — Ivan marca asistencia en vivo, dispara la deuda por falta),
-- ocupacion_sesiones (reemplaza ocupacion_clases) y copiar_semana (duplica
-- sesiones + reservas confirmadas a la semana siguiente).

create or replace function public.reservar_sesion(p_sesion_id uuid, p_cliente_id uuid)
returns public.reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autorizado boolean;
  v_es_admin boolean;
  v_sesion public.sesiones;
  v_clase public.clases;
  v_cliente public.clientes;
  v_plan public.planes;
  v_bono public.bonos_cliente;
  v_aforo integer;
  v_confirmadas integer;
  v_estado estado_reserva_enum;
  v_reserva public.reservas;
begin
  v_es_admin := public.auth_rol() = 'admin';

  select (
    exists (select 1 from public.clientes c where c.id = p_cliente_id and c.usuario_id = auth.uid())
    or v_es_admin
  ) into v_autorizado;

  if not v_autorizado then
    raise exception 'No autorizado para reservar en nombre de esta clienta';
  end if;

  select * into v_sesion from public.sesiones where id = p_sesion_id for update;
  if not found then
    raise exception 'Sesion no encontrada';
  end if;

  if not v_es_admin and v_sesion.fecha > current_date + 21 then
    raise exception 'Esta sesion esta fuera de la ventana de reserva de 3 semanas';
  end if;

  select * into v_clase from public.clases where id = v_sesion.clase_id;

  select * into v_cliente from public.clientes where id = p_cliente_id;
  if not found then
    raise exception 'Cliente no encontrado';
  end if;

  if v_cliente.estado = 'baja' then
    raise exception 'La clienta esta dada de baja';
  end if;

  if exists (
    select 1 from public.reservas
    where sesion_id = p_sesion_id and cliente_id = p_cliente_id and estado <> 'cancelada'
  ) then
    raise exception 'Ya existe una reserva activa para esta sesion';
  end if;

  select * into v_plan from public.planes where id = v_cliente.plan_id;

  if v_plan.tipo = 'bono' then
    select * into v_bono from public.bonos_cliente
      where cliente_id = p_cliente_id and activo = true
        and (fecha_caducidad is null or fecha_caducidad >= current_date)
        and (creditos_totales - creditos_usados) > 0
      order by fecha_caducidad asc nulls last, fecha_compra asc
      limit 1;
    if not found then
      raise exception 'No quedan creditos de bono disponibles';
    end if;
  end if;

  v_aforo := coalesce(v_sesion.aforo_efectivo, v_clase.aforo_max);

  select count(*) into v_confirmadas from public.reservas
    where sesion_id = p_sesion_id and estado = 'confirmada';

  v_estado := case when v_confirmadas < v_aforo then 'confirmada' else 'lista_espera' end;

  insert into public.reservas (sesion_id, cliente_id, estado)
  values (p_sesion_id, p_cliente_id, v_estado)
  returning * into v_reserva;

  if v_estado = 'confirmada' and v_plan.tipo = 'bono' then
    update public.bonos_cliente set creditos_usados = creditos_usados + 1 where id = v_bono.id;
  end if;

  return v_reserva;
exception
  when unique_violation then
    raise exception 'Ya existe una reserva activa para esta sesion';
end;
$$;

revoke all on function public.reservar_sesion(uuid, uuid) from public;
grant execute on function public.reservar_sesion(uuid, uuid) to authenticated;

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
  v_sesion public.sesiones;
  v_clase public.clases;
  v_fecha_hora_sesion timestamp;
  v_cliente public.clientes;
  v_plan public.planes;
  v_bono public.bonos_cliente;
  v_tope_recuperacion integer;
  v_recuperaciones_mes integer;
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

  select * into v_sesion from public.sesiones where id = v_reserva.sesion_id;
  select * into v_clase from public.clases where id = v_sesion.clase_id;
  v_fecha_hora_sesion := v_sesion.fecha + v_clase.hora_inicio;

  update public.reservas set estado = 'cancelada', cancelada_en = now() where id = p_reserva_id returning * into v_reserva;

  if v_estado_original = 'confirmada' then
    select * into v_cliente from public.clientes where id = v_reserva.cliente_id;
    select * into v_plan from public.planes where id = v_cliente.plan_id;

    if v_plan.tipo = 'bono' then
      select * into v_bono from public.bonos_cliente
        where cliente_id = v_reserva.cliente_id and activo = true
          and (fecha_caducidad is null or fecha_caducidad >= current_date)
        order by fecha_caducidad asc nulls last, fecha_compra asc
        limit 1;
      if found then
        update public.bonos_cliente
          set creditos_usados = greatest(0, creditos_usados - 1)
          where id = v_bono.id;
      end if;
    end if;

    if v_fecha_hora_sesion >= now() + interval '24 hours' then
      v_tope_recuperacion := case when v_cliente.dias_semana_habituales >= 3 then 2 else 1 end;

      select count(*) into v_recuperaciones_mes from public.bonos_cliente
        where cliente_id = v_reserva.cliente_id
          and tipo = 'recuperacion'
          and date_trunc('month', fecha_compra) = date_trunc('month', current_date);

      if v_recuperaciones_mes < v_tope_recuperacion then
        insert into public.bonos_cliente (cliente_id, plan_id, tipo, creditos_totales, creditos_usados, fecha_compra, fecha_caducidad, activo)
        values (v_reserva.cliente_id, null, 'recuperacion', 1, 0, current_date, (current_date + interval '14 days')::date, true);
      end if;
    end if;

    for v_siguiente in
      select * from public.reservas
        where sesion_id = v_reserva.sesion_id and estado = 'lista_espera'
        order by created_at asc
    loop
      select * into v_cliente_siguiente from public.clientes where id = v_siguiente.cliente_id;
      select * into v_plan_siguiente from public.planes where id = v_cliente_siguiente.plan_id;

      if v_plan_siguiente.tipo = 'bono' then
        select * into v_bono_siguiente from public.bonos_cliente
          where cliente_id = v_siguiente.cliente_id and activo = true
            and (fecha_caducidad is null or fecha_caducidad >= current_date)
          order by fecha_caducidad asc nulls last, fecha_compra asc
          limit 1;
        if not found or (v_bono_siguiente.creditos_totales - v_bono_siguiente.creditos_usados) <= 0 then
          continue;
        end if;
        update public.reservas set estado = 'confirmada' where id = v_siguiente.id;
        update public.bonos_cliente set creditos_usados = creditos_usados + 1 where id = v_bono_siguiente.id;
        exit;
      else
        update public.reservas set estado = 'confirmada' where id = v_siguiente.id;
        exit;
      end if;
    end loop;
  end if;

  return v_reserva;
end;
$$;

revoke all on function public.cancelar_reserva(uuid) from public;
grant execute on function public.cancelar_reserva(uuid) to authenticated;

create or replace function public.crear_bono(
  p_cliente_id uuid,
  p_plan_id uuid,
  p_creditos_totales integer,
  p_fecha_compra date,
  p_tipo tipo_bono_enum default 'normal'
)
returns public.bonos_cliente
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente public.clientes;
  v_fecha_caducidad date;
  v_creditos_netos integer;
  v_deuda_aplicada integer;
  v_bono public.bonos_cliente;
begin
  if public.auth_rol() <> 'admin' then
    raise exception 'No autorizado para crear bonos';
  end if;

  select * into v_cliente from public.clientes where id = p_cliente_id for update;
  if not found then
    raise exception 'Cliente no encontrado';
  end if;

  if p_tipo = 'normal' then
    v_fecha_caducidad := (p_fecha_compra + interval '3 months')::date;
    v_deuda_aplicada := least(p_creditos_totales, v_cliente.deuda_creditos);
    v_creditos_netos := p_creditos_totales - v_deuda_aplicada;
    update public.clientes set deuda_creditos = deuda_creditos - v_deuda_aplicada where id = p_cliente_id;
  else
    v_fecha_caducidad := (p_fecha_compra + interval '14 days')::date;
    v_creditos_netos := p_creditos_totales;
  end if;

  insert into public.bonos_cliente (cliente_id, plan_id, tipo, creditos_totales, creditos_usados, fecha_compra, fecha_caducidad, activo)
  values (p_cliente_id, p_plan_id, p_tipo, v_creditos_netos, 0, p_fecha_compra, v_fecha_caducidad, true)
  returning * into v_bono;

  return v_bono;
end;
$$;

revoke all on function public.crear_bono(uuid, uuid, integer, date, tipo_bono_enum) from public;
grant execute on function public.crear_bono(uuid, uuid, integer, date, tipo_bono_enum) to authenticated;

create or replace function public.marcar_asistencia(p_reserva_id uuid, p_asistio boolean)
returns public.reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserva public.reservas;
begin
  if public.auth_rol() not in ('admin', 'entrenador') then
    raise exception 'No autorizado para marcar asistencia';
  end if;

  select * into v_reserva from public.reservas where id = p_reserva_id;
  if not found then
    raise exception 'Reserva no encontrada';
  end if;

  if v_reserva.estado <> 'confirmada' then
    raise exception 'Solo se puede marcar asistencia de una reserva confirmada';
  end if;

  update public.reservas
    set asistencia = case when p_asistio then 'asistio' else 'no_asistio' end
    where id = p_reserva_id
    returning * into v_reserva;

  if not p_asistio then
    update public.clientes set deuda_creditos = deuda_creditos + 1 where id = v_reserva.cliente_id;
  end if;

  return v_reserva;
end;
$$;

revoke all on function public.marcar_asistencia(uuid, boolean) from public;
grant execute on function public.marcar_asistencia(uuid, boolean) to authenticated;

create or replace function public.ocupacion_sesiones()
returns table (sesion_id uuid, confirmadas integer)
language sql
stable
security definer
set search_path = public
as $$
  select sesion_id, count(*)::integer as confirmadas
  from public.reservas
  where estado = 'confirmada'
  group by sesion_id;
$$;

revoke all on function public.ocupacion_sesiones() from public;
grant execute on function public.ocupacion_sesiones() to authenticated;

create or replace function public.copiar_semana(p_fecha_origen date, p_fecha_destino date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offset integer;
  v_sesion_origen record;
  v_nueva_sesion_id uuid;
  v_reserva record;
  v_creadas integer := 0;
begin
  if public.auth_rol() <> 'admin' then
    raise exception 'No autorizado para copiar el horario';
  end if;

  v_offset := p_fecha_destino - p_fecha_origen;

  for v_sesion_origen in
    select * from public.sesiones where fecha = p_fecha_origen
  loop
    v_nueva_sesion_id := null;

    insert into public.sesiones (clase_id, fecha)
    values (v_sesion_origen.clase_id, v_sesion_origen.fecha + v_offset)
    on conflict (clase_id, fecha) do nothing
    returning id into v_nueva_sesion_id;

    if v_nueva_sesion_id is null then
      select id into v_nueva_sesion_id from public.sesiones
        where clase_id = v_sesion_origen.clase_id and fecha = v_sesion_origen.fecha + v_offset;
    end if;

    for v_reserva in
      select * from public.reservas where sesion_id = v_sesion_origen.id and estado = 'confirmada'
    loop
      begin
        perform public.reservar_sesion(v_nueva_sesion_id, v_reserva.cliente_id);
        v_creadas := v_creadas + 1;
      exception
        when others then
          raise notice 'No se pudo copiar reserva de % en sesion %: %', v_reserva.cliente_id, v_nueva_sesion_id, sqlerrm;
      end;
    end loop;
  end loop;

  return v_creadas;
end;
$$;

revoke all on function public.copiar_semana(date, date) from public;
grant execute on function public.copiar_semana(date, date) to authenticated;
```

- [ ] **Step 2: Aplicar la migración**

Run: `supabase db push`
Expected: sin errores. `select proname from pg_proc where proname in ('reservar_sesion','cancelar_reserva','crear_bono','marcar_asistencia','ocupacion_sesiones','copiar_semana');` devuelve las 6.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_rpc_reglas_negocio.sql
git commit -m "feat: add reservar_sesion, crear_bono, marcar_asistencia (admin+entrenador), ocupacion_sesiones, copiar_semana RPCs"
```

---

### Task 4: Regenerar `lib/database.types.ts`

**Files:**
- Modify: `lib/database.types.ts` (regenerado, no editar a mano)

**Interfaces:**
- Consumes: esquema final de Tasks 1-3.
- Produces: tipos `Database["public"]["Tables"]["sesiones" | "reservas_historial"]`, `Database["public"]["Functions"]["reservar_sesion" | "cancelar_reserva" | "crear_bono" | "marcar_asistencia" | "ocupacion_sesiones" | "copiar_semana"]`, usados por todas las tareas siguientes.

- [ ] **Step 1: Regenerar**

Run: `npx supabase gen types typescript --project-id pdvpruktssojuicwhhlt --schema public > lib/database.types.ts`
Expected: el archivo se sobreescribe; `git diff --stat lib/database.types.ts` muestra cambios (nuevas tablas/funciones, `reservar_clase`/`ocupacion_clases` ya no aparecen).

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: fallará en `lib/supabase/queries.ts`, `lib/selectors.ts`, `lib/actions/reservas.ts` y `scripts/seed.ts` (esperado — se arregla en las tareas siguientes). No debe fallar dentro del propio `lib/database.types.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/database.types.ts
git commit -m "chore: regenerate database types for v1 business rules schema"
```

---

### Task 5: Actualizar `lib/types.ts`

**Files:**
- Modify: `lib/types.ts`

**Interfaces:**
- Produces: `Sesion`, `EstadoAsistencia`, `TipoBono`; `Reserva.sesionId` (en vez de `claseId`), `Reserva.asistencia`, `Reserva.canceladaEn`; `Cliente.diasSemanaHabituales`, `Cliente.deudaCreditos`; `BonoCliente.tipo`, `BonoCliente.fechaCaducidad`, `BonoCliente.planId: string | null`.

- [ ] **Step 1: Editar el archivo**

Reemplazar el contenido completo de `lib/types.ts` por:

```ts
export type Rol = "admin" | "entrenador" | "cliente";
export type DiaSemana = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";
export type EstadoCliente = "activo" | "baja";
export type TipoPlan = "mensual" | "bono";
export type EstadoReserva = "confirmada" | "lista_espera" | "cancelada";
export type EstadoAsistencia = "pendiente" | "asistio" | "no_asistio";
export type TipoBono = "normal" | "recuperacion";
export type MetodoPago = "stripe" | "efectivo" | "transferencia";
export type EstadoPago = "al_dia" | "moroso" | "pendiente";

export interface Centro {
  id: string;
  nombre: string;
  logoUrl: string | null;
  colorMarca: string;
}

export interface Usuario {
  id: string;
  email: string;
  rol: Rol;
  nombre: string;
  telefono: string;
}

export interface Plan {
  id: string;
  nombre: string;
  precio: number;
  tipo: TipoPlan;
  clasesIncluidas: number | null;
}

export interface Cliente {
  id: string;
  usuarioId: string;
  estado: EstadoCliente;
  planId: string;
  notasRutina: string;
  diasSemanaHabituales: number;
  deudaCreditos: number;
  createdAt: string;
}

export interface Clase {
  id: string;
  dia: DiaSemana;
  horaInicio: string;
  horaFin: string;
  aforoMax: number;
  entrenadorId: string;
  recurrente: boolean;
}

export interface Sesion {
  id: string;
  claseId: string;
  fecha: string;
  aforoEfectivo: number | null;
  createdAt: string;
}

export interface Reserva {
  id: string;
  sesionId: string;
  clienteId: string;
  estado: EstadoReserva;
  asistencia: EstadoAsistencia;
  canceladaEn: string | null;
  createdAt: string;
}

export interface Pago {
  id: string;
  clienteId: string;
  planId: string;
  tipo: TipoPlan;
  metodo: MetodoPago;
  estado: EstadoPago;
  importe: number;
  fechaPago: string;
  ultimoCobro: string | null;
  proximoCobro: string | null;
  registradoPor: string;
}

export interface BonoCliente {
  id: string;
  clienteId: string;
  planId: string | null;
  tipo: TipoBono;
  creditosTotales: number;
  creditosUsados: number;
  fechaCompra: string;
  fechaCaducidad: string | null;
  activo: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add Sesion type and update Reserva/BonoCliente/Cliente for v1 rules"
```

---

### Task 6: Actualizar `lib/supabase/queries.ts`

**Files:**
- Modify: `lib/supabase/queries.ts`

**Interfaces:**
- Consumes: `Sesion`, tipos actualizados de Task 5.
- Produces: `obtenerSesiones(): Promise<Sesion[]>`, `obtenerOcupacionSesiones(): Promise<Record<string, number>>` (reemplaza `obtenerOcupacionClases`). `obtenerReservas`, `obtenerBonosCliente`, `obtenerClientes` actualizadas a las nuevas columnas.

- [ ] **Step 1: Reemplazar el contenido completo de `lib/supabase/queries.ts`**

```ts
import { createClient } from "@/lib/supabase/server";
import type { Cliente, Usuario, Plan, Clase, Sesion, Reserva, Pago, BonoCliente } from "@/lib/types";

export async function obtenerClientes(): Promise<Cliente[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("id, usuario_id, estado, plan_id, notas_rutina, dias_semana_habituales, deuda_creditos, created_at");
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    usuarioId: c.usuario_id,
    estado: c.estado,
    planId: c.plan_id,
    notasRutina: c.notas_rutina,
    diasSemanaHabituales: c.dias_semana_habituales,
    deudaCreditos: c.deuda_creditos,
    createdAt: c.created_at,
  }));
}

export async function obtenerClienteDeUsuario(usuarioId: string): Promise<Cliente | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("id, usuario_id, estado, plan_id, notas_rutina, dias_semana_habituales, deuda_creditos, created_at")
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
    diasSemanaHabituales: data.dias_semana_habituales,
    deudaCreditos: data.deuda_creditos,
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

export async function obtenerSesiones(): Promise<Sesion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sesiones")
    .select("id, clase_id, fecha, aforo_efectivo, created_at");
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    claseId: s.clase_id,
    fecha: s.fecha,
    aforoEfectivo: s.aforo_efectivo,
    createdAt: s.created_at,
  }));
}

export async function obtenerReservas(): Promise<Reserva[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservas")
    .select("id, sesion_id, cliente_id, estado, asistencia, cancelada_en, created_at");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    sesionId: r.sesion_id,
    clienteId: r.cliente_id,
    estado: r.estado,
    asistencia: r.asistencia,
    canceladaEn: r.cancelada_en,
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
    .select("id, cliente_id, plan_id, tipo, creditos_totales, creditos_usados, fecha_compra, fecha_caducidad, activo");
  if (error) throw error;
  return (data ?? []).map((b) => ({
    id: b.id,
    clienteId: b.cliente_id,
    planId: b.plan_id,
    tipo: b.tipo,
    creditosTotales: b.creditos_totales,
    creditosUsados: b.creditos_usados,
    fechaCompra: b.fecha_compra,
    fechaCaducidad: b.fecha_caducidad,
    activo: b.activo,
  }));
}

export async function obtenerOcupacionSesiones(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ocupacion_sesiones");
  if (error) throw error;
  const mapa: Record<string, number> = {};
  for (const fila of data ?? []) {
    mapa[fila.sesion_id] = fila.confirmadas;
  }
  return mapa;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/queries.ts
git commit -m "feat: add obtenerSesiones, replace obtenerOcupacionClases with obtenerOcupacionSesiones"
```

---

### Task 7: Actualizar `lib/selectors.ts`

**Files:**
- Modify: `lib/selectors.ts`

**Interfaces:**
- Consumes: `Sesion`, `Reserva` (con `sesionId`) de Task 5.
- Produces: `reservasConfirmadasDeSesion`, `reservasListaEsperaDeSesion`, `plazasLibres(sesion, clase, reservas)`, `reservaActivaDeClienteEnSesion` (reemplazan las versiones `DeClase`).

- [ ] **Step 1: Reemplazar el contenido completo de `lib/selectors.ts`**

```ts
import type { Usuario, Cliente, Plan, Clase, Sesion, Reserva, Pago, BonoCliente, DiaSemana } from "./types";

export const ORDEN_DIAS: DiaSemana[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

export function usuarioPorId(usuarios: Usuario[], id: string): Usuario | undefined {
  return usuarios.find((u) => u.id === id);
}

export function clientePorId(clientes: Cliente[], id: string): Cliente | undefined {
  return clientes.find((c) => c.id === id);
}

export function planPorId(planes: Plan[], id: string): Plan | undefined {
  return planes.find((p) => p.id === id);
}

export function reservasConfirmadasDeSesion(reservas: Reserva[], sesionId: string): Reserva[] {
  return reservas.filter((r) => r.sesionId === sesionId && r.estado === "confirmada");
}

export function reservasListaEsperaDeSesion(reservas: Reserva[], sesionId: string): Reserva[] {
  return reservas.filter((r) => r.sesionId === sesionId && r.estado === "lista_espera");
}

export function plazasLibres(sesion: Sesion, clase: Clase, reservas: Reserva[]): number {
  const aforo = sesion.aforoEfectivo ?? clase.aforoMax;
  return aforo - reservasConfirmadasDeSesion(reservas, sesion.id).length;
}

export function bonoDeCliente(bonos: BonoCliente[], clienteId: string): BonoCliente | undefined {
  const hoy = new Date().toISOString().slice(0, 10);
  return bonos
    .filter((b) => b.clienteId === clienteId && b.activo && (!b.fechaCaducidad || b.fechaCaducidad >= hoy))
    .sort((a, b) => (a.fechaCaducidad ?? "9999-12-31").localeCompare(b.fechaCaducidad ?? "9999-12-31"))[0];
}

export function creditosRestantes(bono: BonoCliente): number {
  return bono.creditosTotales - bono.creditosUsados;
}

export function pagoDeCliente(pagos: Pago[], clienteId: string): Pago | undefined {
  return pagos.find((p) => p.clienteId === clienteId);
}

export function reservaActivaDeClienteEnSesion(reservas: Reserva[], clienteId: string, sesionId: string): Reserva | undefined {
  return reservas.find((r) => r.clienteId === clienteId && r.sesionId === sesionId && r.estado !== "cancelada");
}
```

- [ ] **Step 2: Verificar compilación de la capa de datos**

Run: `npx tsc --noEmit`
Expected: `lib/supabase/queries.ts`, `lib/selectors.ts` y `lib/types.ts` ya no dan error. Siguen fallando `lib/actions/reservas.ts`, `lib/actions/clientes.ts` y `scripts/seed.ts` (se arreglan en las tareas siguientes).

- [ ] **Step 3: Commit**

```bash
git add lib/selectors.ts
git commit -m "feat: adapt selectors to sesion-scoped reservas"
```

---

### Task 8: Actualizar `lib/actions/reservas.ts` (reservarSesion)

**Files:**
- Modify: `lib/actions/reservas.ts`

**Interfaces:**
- Produces: `reservarSesion(sesionId: string, clienteId: string): Promise<{ error?: string }>` (reemplaza `reservarClase`), `cancelarReserva` sin cambios de firma.

- [ ] **Step 1: Reemplazar el contenido completo de `lib/actions/reservas.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function traducirError(mensaje: string): string {
  if (mensaje.includes("creditos de bono")) return "No quedan créditos de bono disponibles";
  if (mensaje.includes("reserva activa")) return "Ya tienes una reserva activa para esta sesión";
  if (mensaje.includes("ventana de reserva")) return "Esta clase está fuera de tu ventana de reserva de 3 semanas";
  if (mensaje.includes("no encontrad")) return "No se ha encontrado la sesión o la reserva";
  if (mensaje.includes("cancelada")) return "Esa reserva ya estaba cancelada";
  if (mensaje.includes("dada de baja")) return "Esta clienta esta dada de baja";
  if (mensaje.includes("No autorizado")) return "No tienes permiso para hacer esta acción";
  return "No se pudo completar la reserva";
}

export async function reservarSesion(sesionId: string, clienteId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reservar_sesion", { p_sesion_id: sesionId, p_cliente_id: clienteId });
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

- [ ] **Step 2: Commit**

```bash
git add lib/actions/reservas.ts
git commit -m "feat: rename reservarClase to reservarSesion for the sesiones model"
```

---

### Task 9: Nuevo `lib/actions/asistencia.ts`

**Files:**
- Create: `lib/actions/asistencia.ts`

**Interfaces:**
- Produces: `marcarAsistencia(reservaId: string, asistio: boolean): Promise<{ error?: string }>` — invocable por admin y entrenador (la RPC hace la comprobación de rol).

- [ ] **Step 1: Crear el archivo**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function marcarAsistencia(reservaId: string, asistio: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_asistencia", { p_reserva_id: reservaId, p_asistio: asistio });
  if (error) return { error: error.message };

  revalidatePath("/admin/clases");
  revalidatePath("/entrenador/clases");
  return {};
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/asistencia.ts
git commit -m "feat: add marcarAsistencia server action (admin and entrenador)"
```

---

### Task 10: Nuevo `lib/actions/bonos.ts` y refactor de `lib/actions/clientes.ts`

**Files:**
- Create: `lib/actions/bonos.ts`
- Modify: `lib/actions/clientes.ts:86-100` (bloque de creación de bono en `altaCliente`), `lib/actions/clientes.ts:176-185` (bloque de creación de bono en `actualizarCliente`)

**Interfaces:**
- Produces: `crearBono(clienteId: string, planId: string, creditosTotales: number, fechaCompra: string): Promise<{ error?: string }>`.
- Consumes (en `clientes.ts`): la misma función `crearBono`, para no duplicar la lógica de caducidad/deuda que ahora vive en la RPC `crear_bono` (Task 3).

- [ ] **Step 1: Crear `lib/actions/bonos.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearBono(
  clienteId: string,
  planId: string,
  creditosTotales: number,
  fechaCompra: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_bono", {
    p_cliente_id: clienteId,
    p_plan_id: planId,
    p_creditos_totales: creditosTotales,
    p_fecha_compra: fechaCompra,
    p_tipo: "normal",
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/clientes");
  revalidatePath("/admin/cobros");
  revalidatePath("/entrenador/clientes");
  revalidatePath("/entrenador/cobros");
  return {};
}
```

- [ ] **Step 2: Editar `altaCliente` en `lib/actions/clientes.ts`**

Reemplazar (líneas 86-100 del archivo original):

```ts
  if (plan.tipo === "bono") {
    const { error: errorBono } = await supabase.from("bonos_cliente").insert({
      cliente_id: cliente.id,
      plan_id: plan.id,
      creditos_totales: plan.clases_incluidas ?? 0,
      creditos_usados: 0,
      fecha_compra: fechaHoy,
      activo: true,
    });
    if (errorBono) {
      await supabase.from("clientes").delete().eq("id", cliente.id);
      await adminClient.auth.admin.deleteUser(nuevoAuthUser.user.id);
      return { error: errorBono.message };
    }
  }
```

por:

```ts
  if (plan.tipo === "bono") {
    const { error: errorBono } = await supabase.rpc("crear_bono", {
      p_cliente_id: cliente.id,
      p_plan_id: plan.id,
      p_creditos_totales: plan.clases_incluidas ?? 0,
      p_fecha_compra: fechaHoy,
      p_tipo: "normal",
    });
    if (errorBono) {
      await supabase.from("clientes").delete().eq("id", cliente.id);
      await adminClient.auth.admin.deleteUser(nuevoAuthUser.user.id);
      return { error: errorBono.message };
    }
  }
```

- [ ] **Step 3: Editar `actualizarCliente` en `lib/actions/clientes.ts`**

Reemplazar (líneas 176-185 del archivo original):

```ts
    if (nuevoPlan.tipo === "bono" && !bonoActivo) {
      const { error: errorInsertBono } = await supabase.from("bonos_cliente").insert({
        cliente_id: clienteId,
        plan_id: nuevoPlan.id,
        creditos_totales: nuevoPlan.clases_incluidas ?? 0,
        creditos_usados: 0,
        fecha_compra: new Date().toISOString().slice(0, 10),
        activo: true,
      });
      if (errorInsertBono) return { error: errorInsertBono.message };
    } else if (nuevoPlan.tipo === "mensual" && bonoActivo) {
```

por:

```ts
    if (nuevoPlan.tipo === "bono" && !bonoActivo) {
      const { error: errorInsertBono } = await supabase.rpc("crear_bono", {
        p_cliente_id: clienteId,
        p_plan_id: nuevoPlan.id,
        p_creditos_totales: nuevoPlan.clases_incluidas ?? 0,
        p_fecha_compra: new Date().toISOString().slice(0, 10),
        p_tipo: "normal",
      });
      if (errorInsertBono) return { error: errorInsertBono.message };
    } else if (nuevoPlan.tipo === "mensual" && bonoActivo) {
```

- [ ] **Step 4: Commit**

```bash
git add lib/actions/bonos.ts lib/actions/clientes.ts
git commit -m "feat: create bonos via crear_bono RPC to apply caducidad/deuda consistently"
```

---

### Task 11: Nuevo `lib/actions/horarios.ts` (copiarSemana)

**Files:**
- Create: `lib/actions/horarios.ts`

**Interfaces:**
- Produces: `copiarSemana(fechaOrigen: string, fechaDestino: string): Promise<{ creadas?: number; error?: string }>`.

- [ ] **Step 1: Crear el archivo**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function copiarSemana(fechaOrigen: string, fechaDestino: string): Promise<{ creadas?: number; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copiar_semana", {
    p_fecha_origen: fechaOrigen,
    p_fecha_destino: fechaDestino,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/clases");
  revalidatePath("/entrenador/clases");
  revalidatePath("/cliente");
  return { creadas: data ?? 0 };
}
```

- [ ] **Step 2: Verificar que toda la capa `lib/` compila**

Run: `npx tsc --noEmit`
Expected: solo queda fallando `scripts/seed.ts` (se arregla en el Task 12) y los tests de integración existentes que aún usan `clase_id`/`reservar_clase` (se arreglan en el Task 13).

- [ ] **Step 3: Commit**

```bash
git add lib/actions/horarios.ts
git commit -m "feat: add copiarSemana server action"
```

---

### Task 12: Actualizar `scripts/seed.ts`

**Files:**
- Modify: `scripts/seed.ts`

**Interfaces:**
- Produces: seed con `sesiones` (fechas calculadas dinámicamente desde "hoy" para que la ventana de 3 semanas y el chequeo de 24h de los tests sigan siendo válidos sin importar cuándo se corra), `dias_semana_habituales` por cliente.

- [ ] **Step 1: Añadir el helper de fechas, justo antes de `async function main()`**

```ts
const DIA_A_NUMERO: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

function siguienteFecha(dia: string, base: Date): string {
  const objetivo = DIA_A_NUMERO[dia];
  const actual = base.getDay();
  let diff = (objetivo - actual + 7) % 7;
  if (diff === 0) diff = 7;
  const fecha = new Date(base);
  fecha.setDate(fecha.getDate() + diff);
  return fecha.toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Añadir `diasSemanaHabituales` a `clientesSeed` y actualizar el insert de `clientes`**

Reemplazar:

```ts
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
```

por:

```ts
  const clientesSeed = [
    { email: "maria@example.com", planId: planMensual.id, notas: "Full body 3x/semana, foco en tren inferior. Progresar sentadilla goblet.", diasSemana: 3 },
    { email: "laura@example.com", planId: planBono.id, notas: "Circuito funcional, cuidado con el hombro derecho.", diasSemana: 3 },
    { email: "sara@example.com", planId: planMensual.id, notas: "Readaptacion tras baja, sin saltos todavia.", diasSemana: 1 },
    { email: "ana@example.com", planId: planMensual.id, notas: "", diasSemana: 2 },
    { email: "beatriz@example.com", planId: planMensual.id, notas: "", diasSemana: 2 },
    { email: "carla@example.com", planId: planMensual.id, notas: "", diasSemana: 2 },
    { email: "diana@example.com", planId: planMensual.id, notas: "", diasSemana: 2 },
    { email: "eva@example.com", planId: planMensual.id, notas: "", diasSemana: 2 },
  ];

  const idsClientePorEmail = new Map<string, string>();
  for (const c of clientesSeed) {
    const usuarioId = idsPorEmail.get(c.email)!;
    const { data: cliente, error: errorCliente } = await admin
      .from("clientes")
      .insert({ usuario_id: usuarioId, plan_id: c.planId, notas_rutina: c.notas, dias_semana_habituales: c.diasSemana })
      .select()
      .single();
    if (errorCliente || !cliente) throw errorCliente ?? new Error(`No se pudo crear cliente ${c.email}`);
    idsClientePorEmail.set(c.email, cliente.id);
  }
```

- [ ] **Step 3: Crear las sesiones y actualizar el insert de `reservas`**

Reemplazar:

```ts
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
```

por:

```ts
  const hoy = new Date();
  const { data: sesionLunes, error: errorSesionLunes } = await admin
    .from("sesiones")
    .insert({ clase_id: claseLunes.id, fecha: siguienteFecha("lunes", hoy) })
    .select()
    .single();
  if (errorSesionLunes || !sesionLunes) throw errorSesionLunes ?? new Error("No se pudo crear sesion-lunes");

  const { data: sesionMiercoles, error: errorSesionMiercoles } = await admin
    .from("sesiones")
    .insert({ clase_id: claseMiercoles.id, fecha: siguienteFecha("miercoles", hoy) })
    .select()
    .single();
  if (errorSesionMiercoles || !sesionMiercoles) throw errorSesionMiercoles ?? new Error("No se pudo crear sesion-miercoles");

  const { error: errorReservas } = await admin.from("reservas").insert([
    { sesion_id: sesionLunes.id, cliente_id: idMaria, estado: "confirmada" },
    { sesion_id: sesionMiercoles.id, cliente_id: idAna, estado: "confirmada" },
    { sesion_id: sesionMiercoles.id, cliente_id: idBeatriz, estado: "confirmada" },
    { sesion_id: sesionMiercoles.id, cliente_id: idCarla, estado: "confirmada" },
    { sesion_id: sesionMiercoles.id, cliente_id: idDiana, estado: "confirmada" },
    { sesion_id: sesionMiercoles.id, cliente_id: idEva, estado: "confirmada" },
    { sesion_id: sesionMiercoles.id, cliente_id: idLaura, estado: "lista_espera" },
  ]);
  if (errorReservas) throw errorReservas;
```

- [ ] **Step 4: Ajustar la fecha de compra del bono de Laura**

Reemplazar:

```ts
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
```

por:

```ts
  const fechaCompraBono = "2026-07-20";
  const { error: errorBono } = await admin.from("bonos_cliente").insert({
    cliente_id: idLaura,
    plan_id: planBono.id,
    tipo: "normal",
    creditos_totales: 10,
    creditos_usados: 0,
    fecha_compra: fechaCompraBono,
    fecha_caducidad: new Date(new Date(fechaCompraBono).setMonth(new Date(fechaCompraBono).getMonth() + 3))
      .toISOString()
      .slice(0, 10),
    activo: true,
  });
  if (errorBono) throw errorBono;

  console.log("Seed completado.");
  console.log(`Password para las 10 cuentas: ${DEMO_PASSWORD}`);
```

- [ ] **Step 5: Correr el seed contra el proyecto de desarrollo**

Run: `npm run seed`
Expected: `Seed completado.` sin errores. (Requiere que la tabla `centro` esté vacía — si ya se corrió antes, hay que limpiar el proyecto de desarrollo primero; no se automatiza el borrado en este plan porque es una acción destructiva sobre datos que podrían no ser solo de seed.)

- [ ] **Step 6: Verificar compilación completa**

Run: `npx tsc --noEmit`
Expected: sin errores en ningún archivo de `lib/` ni `scripts/`.

- [ ] **Step 7: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat: seed sesiones with dynamic dates and dias_semana_habituales"
```

---

### Task 13: Tests de integración para las RPCs nuevas y modificadas

**Files:**
- Modify: `tests/integration/rpc-reservas.test.ts`
- Modify: `tests/integration/rpc-authz.test.ts`
- Create: `tests/integration/rpc-bonos.test.ts`
- Create: `tests/integration/rpc-asistencia.test.ts`
- Create: `tests/integration/rpc-copiar-semana.test.ts`

**Interfaces:**
- Consumes: `signInAs` y `anonClient` de `tests/integration/helpers.ts` (sin cambios), `createAdminClient` de `lib/supabase/admin.ts`.

- [ ] **Step 1: Adaptar `tests/integration/rpc-reservas.test.ts` al modelo de sesiones**

Reemplazar el contenido completo del archivo:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "../../lib/supabase/admin";
import { signInAs } from "./helpers";

describe("reservar_sesion / cancelar_reserva RPC", () => {
  const admin = createAdminClient();
  let sesionMiercolesId: string;
  let saraClienteId: string;
  let anaClienteId: string;
  let lauraClienteId: string;
  let anaReservaId: string;
  let lauraReservaId: string;

  beforeAll(async () => {
    const { data: clase } = await admin.from("clases").select("id").eq("dia", "miercoles").single();
    const { data: sesion } = await admin.from("sesiones").select("id").eq("clase_id", clase!.id).order("fecha", { ascending: true }).limit(1).single();
    sesionMiercolesId = sesion!.id;

    async function clienteIdPorEmail(email: string): Promise<string> {
      const { data: usuario } = await admin.from("users").select("id").eq("email", email).single();
      const { data: cliente } = await admin.from("clientes").select("id").eq("usuario_id", usuario!.id).single();
      return cliente!.id;
    }

    saraClienteId = await clienteIdPorEmail("sara@example.com");
    anaClienteId = await clienteIdPorEmail("ana@example.com");
    lauraClienteId = await clienteIdPorEmail("laura@example.com");

    const { data: anaReserva } = await admin
      .from("reservas").select("id")
      .eq("sesion_id", sesionMiercolesId).eq("cliente_id", anaClienteId).single();
    anaReservaId = anaReserva!.id;

    const { data: lauraReserva } = await admin
      .from("reservas").select("id")
      .eq("sesion_id", sesionMiercolesId).eq("cliente_id", lauraClienteId).single();
    lauraReservaId = lauraReserva!.id;
  });

  afterAll(async () => {
    await admin.from("reservas").delete().eq("sesion_id", sesionMiercolesId).eq("cliente_id", saraClienteId);
    await admin.from("reservas").update({ estado: "confirmada" }).eq("id", anaReservaId);
    await admin.from("reservas").update({ estado: "lista_espera" }).eq("id", lauraReservaId);
    await admin.from("bonos_cliente").update({ creditos_usados: 0 }).eq("cliente_id", lauraClienteId).eq("tipo", "normal");
    await admin.from("bonos_cliente").delete().eq("cliente_id", lauraClienteId).eq("tipo", "recuperacion");
    await admin.from("bonos_cliente").delete().eq("cliente_id", anaClienteId).eq("tipo", "recuperacion");
  });

  it("reservar_sesion en una sesion con aforo lleno devuelve lista_espera", async () => {
    const sara = await signInAs("sara@example.com");
    const { data, error } = await sara.rpc("reservar_sesion", {
      p_sesion_id: sesionMiercolesId, p_cliente_id: saraClienteId,
    });
    expect(error).toBeNull();
    expect(data?.estado).toBe("lista_espera");
  });

  it("reservar con bono sin creditos restantes falla", async () => {
    await admin.from("bonos_cliente").update({ creditos_usados: 10 }).eq("cliente_id", lauraClienteId).eq("tipo", "normal");
    const laura = await signInAs("laura@example.com");
    const { data: claseLunes } = await admin.from("clases").select("id").eq("dia", "lunes").single();
    const { data: sesionLunes } = await admin.from("sesiones").select("id").eq("clase_id", claseLunes!.id).limit(1).single();
    const { error } = await laura.rpc("reservar_sesion", {
      p_sesion_id: sesionLunes!.id, p_cliente_id: lauraClienteId,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/creditos de bono/);
    await admin.from("bonos_cliente").update({ creditos_usados: 0 }).eq("cliente_id", lauraClienteId).eq("tipo", "normal");
  });

  it("cancelar una reserva confirmada promueve la primera en lista_espera y cobra su credito de bono", async () => {
    const ana = await signInAs("ana@example.com");
    const { data, error } = await ana.rpc("cancelar_reserva", { p_reserva_id: anaReservaId });
    expect(error).toBeNull();
    expect(data?.estado).toBe("cancelada");

    const { data: lauraActualizada } = await admin.from("reservas").select("estado").eq("id", lauraReservaId).single();
    expect(lauraActualizada?.estado).toBe("confirmada");

    const { data: bonoLaura } = await admin.from("bonos_cliente").select("creditos_usados").eq("cliente_id", lauraClienteId).eq("tipo", "normal").single();
    expect(bonoLaura?.creditos_usados).toBe(1);
  });

  it("cancelar la reserva promovida de Laura devuelve su credito de bono", async () => {
    const laura = await signInAs("laura@example.com");
    const { error } = await laura.rpc("cancelar_reserva", { p_reserva_id: lauraReservaId });
    expect(error).toBeNull();

    const { data: bonoLaura } = await admin.from("bonos_cliente").select("creditos_usados").eq("cliente_id", lauraClienteId).eq("tipo", "normal").single();
    expect(bonoLaura?.creditos_usados).toBe(0);
  });
});
```

- [ ] **Step 2: Actualizar `tests/integration/rpc-authz.test.ts`**

Buscar y reemplazar cualquier `rpc("reservar_clase", { p_clase_id: ..., ... })` por `rpc("reservar_sesion", { p_sesion_id: ..., ... })`, obteniendo el `sesion_id` igual que en el Step 1 (vía `admin.from("sesiones").select("id").eq("clase_id", ...).limit(1).single()`) en vez de leer `clases.id` directamente para el parámetro de la RPC. El resto de la lógica de autorización (cliente no puede reservar/cancelar en nombre de otro, entrenador no puede llamar a `crear_bono` ni a `copiar_semana`) no cambia — pero **quitar** cualquier assert de "entrenador no puede llamar a `marcar_asistencia`" si existiera (no debería existir todavía en este archivo, ya que `marcar_asistencia` es nueva de este plan), porque ahora sí puede.

- [ ] **Step 3: Correr los tests existentes adaptados**

Run: `npm run test:integration -- rpc-reservas rpc-authz`
Expected: todos los `it` pasan.

- [ ] **Step 4: Crear `tests/integration/rpc-bonos.test.ts`**

```ts
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
```

- [ ] **Step 5: Correr y verificar**

Run: `npm run test:integration -- rpc-bonos`
Expected: todos los `it` pasan.

- [ ] **Step 6: Crear `tests/integration/rpc-asistencia.test.ts`**

```ts
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
```

- [ ] **Step 7: Correr y verificar**

Run: `npm run test:integration -- rpc-asistencia`
Expected: todos los `it` pasan.

- [ ] **Step 8: Crear `tests/integration/rpc-copiar-semana.test.ts`**

```ts
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
```

- [ ] **Step 9: Correr toda la suite de integración**

Run: `npm run test:integration`
Expected: todos los tests (existentes y nuevos) pasan.

- [ ] **Step 10: Commit**

```bash
git add tests/integration/
git commit -m "test: add integration coverage for sesiones, bonos, asistencia and copiar_semana RPCs"
```

---

## Self-Review Notes

- **Cobertura del spec (Fase 1 según la propuesta comercial del 2026-08-05)**: copiar horario semanal (Task 3 `copiar_semana` + Task 11 + Task 13 Step 8-9), cancelación 24h → bono de recuperación con caducidad 2 semanas y tope mensual 1-2/mes (Task 3 `cancelar_reserva`), asistencia marcada por admin **y entrenador** y deuda (Task 3 `marcar_asistencia` + Task 9), aforo oculto con tope efectivo (Task 1 `sesiones.aforo_efectivo` + Task 3 `reservar_sesion`), lista de espera (ya existía, adaptada a `sesion_id`), ventana de 3 semanas para clientas (Task 3 `reservar_sesion`), caducidad de 3 meses del bono normal (Task 3 `crear_bono`), historial por clase (Task 2). **Fuera a propósito** (Fase 2 según la propuesta comercial, ver Global Constraints): etiquetas de cliente/acceso a clases, bloqueo manual de clases/grupos, referidos/fidelización/notificaciones personalizadas. También fuera: UI, Stripe/Verifactu.
- **Placeholders**: ninguno — cada paso de código trae el contenido completo, sin "TODO" ni "similar a la tarea N".
- **Consistencia de tipos**: `reservar_sesion(p_sesion_id, p_cliente_id)` se usa igual en Task 3 (SQL), Task 8 (`reservarSesion` action) y Task 13 (tests). `Reserva.sesionId` (Task 5) coincide con `sesion_id` mapeado en Task 6 y usado en Task 7. `BonoCliente.planId: string | null` (Task 5) coincide con `plan_id drop not null` (Task 1) y con `crear_bono` insertando `plan_id = null` para bonos de recuperación (Task 3). `marcar_asistencia` autoriza `admin` y `entrenador` de forma consistente entre Task 3 (SQL) y Task 13 Step 6 (test que confirma que Iván sí puede, y Sara —cliente— no puede).
