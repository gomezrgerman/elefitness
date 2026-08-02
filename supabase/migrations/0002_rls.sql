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
