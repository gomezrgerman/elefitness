-- 0018_eliminar_sesion.sql
-- Elena pidio poder borrar una sesion suelta despues de copiar la semana,
-- para festivos y ajustes puntuales (brief-app-centro-entrenamiento.md punto
-- 9). Bloqueada si tiene reservas activas: borrarla arrastraria la reserva en
-- cascada sin devolver el credito de bono ni avisar a la clienta -- Elena
-- tiene que cancelarlas primero (eso si pasa por cancelar_reserva y hace las
-- cosas bien). La guarda necesita mas que RLS por rol, asi que va como RPC,
-- igual que el resto de operaciones con logica de negocio.

create or replace function public.eliminar_sesion(p_sesion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sesion public.sesiones;
  v_clase public.clases;
  v_activas integer;
  v_otras_sesiones integer;
begin
  if public.auth_rol() <> 'admin' then
    raise exception 'No autorizado para eliminar esta sesion';
  end if;

  select * into v_sesion from public.sesiones where id = p_sesion_id for update;
  if not found then
    raise exception 'Sesion no encontrada';
  end if;

  select count(*) into v_activas from public.reservas
    where sesion_id = p_sesion_id and estado <> 'cancelada';
  if v_activas > 0 then
    raise exception 'Esta sesion tiene reservas activas: cancelalas antes de eliminarla';
  end if;

  delete from public.sesiones where id = p_sesion_id;

  -- Si la clase de esta sesion era un hueco puntual (no recurrente), abrirHueco
  -- la creo solo para esta fecha: sin ninguna sesion ya no sirve para nada y se
  -- queda huerfana en el horario. Si fuera del horario fijo (recurrente), no se
  -- toca: sigue existiendo para el resto de semanas.
  select * into v_clase from public.clases where id = v_sesion.clase_id;
  if v_clase.recurrente = false then
    select count(*) into v_otras_sesiones from public.sesiones where clase_id = v_sesion.clase_id;
    if v_otras_sesiones = 0 then
      delete from public.clases where id = v_sesion.clase_id;
    end if;
  end if;
end;
$$;

revoke all on function public.eliminar_sesion(uuid) from public;
grant execute on function public.eliminar_sesion(uuid) to authenticated;
