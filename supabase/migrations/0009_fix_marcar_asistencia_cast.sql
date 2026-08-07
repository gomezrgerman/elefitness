-- 0009_fix_marcar_asistencia_cast.sql
-- Corrige un bug encontrado por los tests de integracion de la Task 13: el
-- CASE con literales de texto en el UPDATE de marcar_asistencia se resuelve
-- a `text`, no al tipo `estado_asistencia_enum` de la columna, y Postgres
-- rechaza la asignacion (42804: column is of type estado_asistencia_enum
-- but expression is of type text). Se anade el cast explicito.

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
    set asistencia = (case when p_asistio then 'asistio' else 'no_asistio' end)::estado_asistencia_enum
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
