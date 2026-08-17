-- 0020_asistencia_libre_y_cobros_relabel.sql
-- Elena confirmo el 2026-08-17 (viendo la app tal cual esta) que quiere poder
-- marcar o cambiar la asistencia en cualquier momento, incluso antes de que
-- empiece la clase: a veces la clienta llega unos minutos antes y prefiere
-- dejarla registrada al momento, y otras veces marca todas las asistencias
-- del dia de golpe al terminar. Quita la guarda que lo impedia (antes
-- rechazaba marcar_asistencia si la clase todavia no habia empezado).
--
-- No hay cambio de etiquetas de cobros en esta migracion (eso es solo texto
-- en components/badge-estado.tsx, no toca la base de datos).

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
