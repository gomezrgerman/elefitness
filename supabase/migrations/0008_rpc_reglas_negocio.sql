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
