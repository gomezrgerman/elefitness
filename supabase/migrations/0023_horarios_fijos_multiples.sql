-- Elena 2026-08-21: la mayoria de clientas entrenan 2-3 dias/semana a la
-- misma hora (ej. lunes/miercoles/viernes 6:30), pero clase_habitual_id
-- (migracion 0022) solo guardaba UNA franja por clienta. Pasa a una tabla
-- de union: una clienta puede tener varios horarios fijos a la vez.

create table public.clientes_horario_fijo (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  clase_id uuid not null references public.clases(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (cliente_id, clase_id)
);

create index clientes_horario_fijo_cliente_id_idx on public.clientes_horario_fijo (cliente_id);
create index clientes_horario_fijo_clase_id_idx on public.clientes_horario_fijo (clase_id);

insert into public.clientes_horario_fijo (cliente_id, clase_id)
  select id, clase_habitual_id from public.clientes where clase_habitual_id is not null;

alter table public.clientes drop column clase_habitual_id;

alter table public.clientes_horario_fijo enable row level security;

create policy "chf_admin_all" on public.clientes_horario_fijo for all to authenticated
  using (public.auth_rol() = 'admin') with check (public.auth_rol() = 'admin');
create policy "chf_entrenador_select" on public.clientes_horario_fijo for select to authenticated
  using (public.auth_rol() = 'entrenador');
create policy "chf_cliente_select_own" on public.clientes_horario_fijo for select to authenticated
  using (exists (
    select 1 from public.clientes c where c.id = clientes_horario_fijo.cliente_id and c.usuario_id = auth.uid()
  ));

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
  v_sesiones_creadas integer := 0;
  v_cliente_habitual record;
begin
  if public.auth_rol() <> 'admin' then
    raise exception 'No autorizado para copiar el horario';
  end if;

  v_offset := p_fecha_destino - p_fecha_origen;

  if v_offset <= 0 or v_offset % 7 <> 0 then
    raise exception 'La fecha destino debe ser posterior a la de origen y a un multiplo de 7 dias';
  end if;

  for v_sesion_origen in
    select s.* from public.sesiones s
      join public.clases c on c.id = s.clase_id
      where s.fecha >= p_fecha_origen and s.fecha < p_fecha_origen + 7
        and c.recurrente = true
      order by s.fecha asc
  loop
    v_nueva_sesion_id := null;

    insert into public.sesiones (clase_id, fecha, aforo_efectivo)
    values (v_sesion_origen.clase_id, v_sesion_origen.fecha + v_offset, v_sesion_origen.aforo_efectivo)
    on conflict (clase_id, fecha) do nothing
    returning id into v_nueva_sesion_id;

    if v_nueva_sesion_id is not null then
      v_sesiones_creadas := v_sesiones_creadas + 1;

      -- Solo las clientas de mensualidad con horario fijo en esta clase se
      -- reservan solas. Los bonos nunca se tocan aqui. Una clienta puede
      -- tener varios horarios fijos: esta clase es solo una de ellos.
      for v_cliente_habitual in
        select c.id from public.clientes c
          join public.planes p on p.id = c.plan_id
          join public.clientes_horario_fijo chf on chf.cliente_id = c.id
          where chf.clase_id = v_sesion_origen.clase_id
            and c.estado = 'activo'
            and p.tipo = 'mensual'
      loop
        begin
          perform public.reservar_sesion(v_nueva_sesion_id, v_cliente_habitual.id);
        exception
          when others then
            null;
        end;
      end loop;
    end if;
  end loop;

  return v_sesiones_creadas;
end;
$$;

revoke all on function public.copiar_semana(date, date) from public;
grant execute on function public.copiar_semana(date, date) to authenticated;

create or replace function public.mover_horario_cliente(
  p_cliente_id uuid,
  p_clase_origen_id uuid,
  p_clase_destino_id uuid,
  p_desde date,
  p_marcar_fijo boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente public.clientes;
  v_plan public.planes;
  v_reserva record;
  v_sesion_destino record;
  v_movidas integer := 0;
  v_siguiente public.reservas;
  v_cliente_siguiente public.clientes;
  v_plan_siguiente public.planes;
  v_bono_siguiente public.bonos_cliente;
begin
  if public.auth_rol() <> 'admin' then
    raise exception 'No autorizado para cambiar el horario de una clienta';
  end if;

  select * into v_cliente from public.clientes where id = p_cliente_id for update;
  if not found then
    raise exception 'Clienta no encontrada';
  end if;

  select * into v_plan from public.planes where id = v_cliente.plan_id;

  if p_marcar_fijo and (v_plan.id is null or v_plan.tipo <> 'mensual') then
    raise exception 'Solo las clientas de mensualidad pueden tener horario fijo';
  end if;

  -- 1. Cancela sin penalizacion las reservas confirmadas futuras del
  --    horario de origen, desde la fecha indicada.
  if p_clase_origen_id is not null then
    for v_reserva in
      select r.* from public.reservas r
        join public.sesiones s on s.id = r.sesion_id
        where r.cliente_id = p_cliente_id
          and s.clase_id = p_clase_origen_id
          and s.fecha >= p_desde
          and r.estado = 'confirmada'
    loop
      update public.reservas set estado = 'cancelada', cancelada_en = now() where id = v_reserva.id;

      if v_reserva.bono_id is not null then
        update public.bonos_cliente set creditos_usados = creditos_usados - 1 where id = v_reserva.bono_id;
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
              and (fecha_caducidad is null or fecha_caducidad >= public.hoy_en_espana())
              and (creditos_totales - creditos_usados) > 0
            order by fecha_caducidad asc nulls last, fecha_compra asc
            limit 1;
          if not found then
            continue;
          end if;
          update public.reservas set estado = 'confirmada', bono_id = v_bono_siguiente.id where id = v_siguiente.id;
          update public.bonos_cliente set creditos_usados = creditos_usados + 1 where id = v_bono_siguiente.id;
          exit;
        else
          update public.reservas set estado = 'confirmada' where id = v_siguiente.id;
          exit;
        end if;
      end loop;
    end loop;

    -- Ya no cuenta como uno de sus horarios fijos, tenga o no reservas
    -- activas ahora mismo en esa clase.
    delete from public.clientes_horario_fijo where cliente_id = p_cliente_id and clase_id = p_clase_origen_id;
  end if;

  -- 2. Reserva en las sesiones ya existentes del horario nuevo, desde la
  --    fecha indicada, saltando las que ya tuviera o esten completas.
  for v_sesion_destino in
    select * from public.sesiones
      where clase_id = p_clase_destino_id and fecha >= p_desde
      order by fecha asc
  loop
    begin
      perform public.reservar_sesion(v_sesion_destino.id, p_cliente_id);
      v_movidas := v_movidas + 1;
    exception
      when others then
        null;
    end;
  end loop;

  -- 3. Añade el horario nuevo al conjunto de horarios fijos (una clienta
  --    puede tener varios a la vez, este se suma, no reemplaza).
  if p_marcar_fijo then
    insert into public.clientes_horario_fijo (cliente_id, clase_id)
      values (p_cliente_id, p_clase_destino_id)
      on conflict (cliente_id, clase_id) do nothing;
  end if;

  return v_movidas;
end;
$$;

revoke all on function public.mover_horario_cliente(uuid, uuid, uuid, date, boolean) from public;
grant execute on function public.mover_horario_cliente(uuid, uuid, uuid, date, boolean) to authenticated;
