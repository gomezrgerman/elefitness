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
