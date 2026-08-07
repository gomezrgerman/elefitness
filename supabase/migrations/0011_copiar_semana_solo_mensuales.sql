-- 0011_copiar_semana_solo_mensuales.sql
-- copiar_semana arrastraba TODAS las reservas confirmadas de la semana origen,
-- y como copiarlas pasa por reservar_sesion, a cada clienta de bono se le
-- descontaba un credito por sesion copiada. Desde 0010 la copia abarca siete
-- dias en vez de uno y cancelar ya no devuelve el credito, asi que una sola
-- pulsacion de Elena podia gastarle a una clienta media docena de creditos sin
-- que nadie los hubiera pedido y sin forma de deshacerlo.
--
-- Regla acordada: las sesiones se copian siempre; las reservas solo de las
-- clientas con plan mensual —horario fijo, no consumen creditos, y son
-- precisamente las que Elena tendria que recolocar a mano cada semana—. Las de
-- bono reservan ellas su plaza en la semana nueva, que es lo coherente con
-- pagar por sesion suelta.
--
-- El valor de retorno pasa a ser el numero de SESIONES creadas. Antes contaba
-- reservas, asi que una semana de seis clases vacias devolvia 0 y parecia que
-- no se habia copiado nada.

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
  v_sesiones_creadas integer := 0;
begin
  if public.auth_rol() <> 'admin' then
    raise exception 'No autorizado para copiar el horario';
  end if;

  v_offset := p_fecha_destino - p_fecha_origen;

  -- La operacion es "duplicar la semana X en la semana Y": si el
  -- desplazamiento no es un multiplo positivo de 7, los dias de la semana no
  -- se corresponden y el horario copiado saldria descolocado.
  if v_offset <= 0 or v_offset % 7 <> 0 then
    raise exception 'La fecha destino debe ser posterior a la de origen y a un multiplo de 7 dias';
  end if;

  for v_sesion_origen in
    select * from public.sesiones
      where fecha >= p_fecha_origen and fecha < p_fecha_origen + 7
      order by fecha asc
  loop
    v_nueva_sesion_id := null;

    insert into public.sesiones (clase_id, fecha, aforo_efectivo)
    values (v_sesion_origen.clase_id, v_sesion_origen.fecha + v_offset, v_sesion_origen.aforo_efectivo)
    on conflict (clase_id, fecha) do nothing
    returning id into v_nueva_sesion_id;

    if v_nueva_sesion_id is null then
      -- La sesion destino ya existia (copiar dos veces la misma semana, o una
      -- sesion creada a mano): se reutiliza y no cuenta como creada.
      select id into v_nueva_sesion_id from public.sesiones
        where clase_id = v_sesion_origen.clase_id and fecha = v_sesion_origen.fecha + v_offset;
    else
      v_sesiones_creadas := v_sesiones_creadas + 1;
    end if;

    -- Solo las mensuales. Se copia via reservar_sesion para no saltarse sus
    -- comprobaciones (clienta de baja, duplicados, aforo -> lista de espera).
    for v_reserva in
      select r.cliente_id
        from public.reservas r
        join public.clientes c on c.id = r.cliente_id
        join public.planes p on p.id = c.plan_id
        where r.sesion_id = v_sesion_origen.id
          and r.estado = 'confirmada'
          and p.tipo = 'mensual'
    loop
      begin
        perform public.reservar_sesion(v_nueva_sesion_id, v_reserva.cliente_id);
      exception
        when others then
          raise notice 'No se pudo copiar reserva de % en sesion %: %', v_reserva.cliente_id, v_nueva_sesion_id, sqlerrm;
      end;
    end loop;
  end loop;

  return v_sesiones_creadas;
end;
$$;

revoke all on function public.copiar_semana(date, date) from public;
grant execute on function public.copiar_semana(date, date) to authenticated;
