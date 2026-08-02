create unique index reservas_activa_unica_idx on public.reservas (clase_id, cliente_id) where estado <> 'cancelada';

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

  select * into v_clase from public.clases where id = p_clase_id for update;
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
exception
  when unique_violation then
    raise exception 'Ya existe una reserva activa para esta clase';
end;
$$;
