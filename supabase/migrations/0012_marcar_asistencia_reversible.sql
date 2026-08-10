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
