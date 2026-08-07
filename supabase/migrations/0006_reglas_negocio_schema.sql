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
