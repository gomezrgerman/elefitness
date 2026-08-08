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
