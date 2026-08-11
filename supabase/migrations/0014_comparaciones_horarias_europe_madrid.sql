-- 0014_comparaciones_horarias_europe_madrid.sql
-- marcar_asistencia, reservar_sesion y cancelar_reserva comparan el instante
-- de una sesion (sesion.fecha + clase.hora_inicio, guardado como hora de pared
-- de Espana: asi es como Elena e Ivan piensan y escriben los horarios) contra
-- now(). `date + time` da un timestamp SIN zona, y Postgres lo compara con
-- now() (timestamptz) interpretandolo en la zona de la sesion, que en Supabase
-- es UTC. Una clase guardada como 10:00 se evaluaba como las 10:00 UTC, es
-- decir las 12:00 de Madrid en verano (11:00 en invierno).
--
-- La consecuencia mas grave: marcar_asistencia rechazaba con "Esta clase
-- todavia no ha empezado" hasta dos horas despues de que la clase hubiera
-- terminado de verdad. Pasar lista no funcionaba en verano.
--
-- El arreglo: `(fecha + hora_inicio) at time zone 'Europe/Madrid'` interpreta
-- ese timestamp sin zona como hora de pared de Madrid y da un timestamptz real,
-- comparable con now() sin que la zona de sesion de Postgres se meta por medio.
-- No cambia ninguna regla de negocio (margen de 24h para cancelar y para la
-- compensacion, caducidad de 14 dias del bono de recuperacion, tope mensual de
-- recuperaciones, ventana de 3 semanas): solo el instante contra el que se
-- evaluan, que ahora es el correcto en vez de estar desplazado 1-2h.
--
-- Cuerpos vivos verificados con
-- `grep -n "^create or replace function" supabase/migrations/*.sql`:
--   - marcar_asistencia: redefinida por ultima vez en 0012 (0009 y 0008 quedan
--     supersedidas).
--   - reservar_sesion y cancelar_reserva: redefinidas por ultima vez en 0013
--     (NO 0010, que 0013 supersede; 0011 y 0012 no las tocan). El comentario de
--     0013 documenta ese mismo cuerpo vivo.
-- Las tres se redefinen aqui a partir de esos cuerpos, cambiando solo las
-- comparaciones de instante.
--
-- De paso se cierra un pendiente menor: hoy_en_espana() (anadida en 0013) se
-- quedo sin el par revoke/grant ni el set search_path que tiene el resto de
-- funciones del proyecto. Se anaden los tres aqui.

create or replace function public.hoy_en_espana()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Europe/Madrid')::date;
$$;

revoke all on function public.hoy_en_espana() from public;
grant execute on function public.hoy_en_espana() to authenticated;

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

  if ((v_sesion.fecha + v_clase.hora_inicio) at time zone 'Europe/Madrid') > now() then
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

  select * into v_clase from public.clases where id = v_sesion.clase_id;

  -- Cota inferior de la ventana de reserva: una sesion que ya ha empezado no se
  -- puede reservar (ni siquiera por el admin: consumiria un credito contra una
  -- clase que ya ocurrio).
  if ((v_sesion.fecha + v_clase.hora_inicio) at time zone 'Europe/Madrid') < now() then
    raise exception 'Esta sesion ya ha pasado';
  end if;

  if not v_es_admin and v_sesion.fecha > public.hoy_en_espana() + 21 then
    raise exception 'Esta sesion esta fuera de la ventana de reserva de 3 semanas';
  end if;

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
        and (fecha_caducidad is null or fecha_caducidad >= public.hoy_en_espana())
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
  v_fecha_hora_sesion timestamptz;
  v_cliente public.clientes;
  v_plan public.planes;
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
  v_fecha_hora_sesion := (v_sesion.fecha + v_clase.hora_inicio) at time zone 'Europe/Madrid';

  if v_fecha_hora_sesion < now() then
    raise exception 'Esta sesion ya ha pasado, no se puede cancelar';
  end if;

  if v_reserva.asistencia <> 'pendiente' then
    raise exception 'No se puede cancelar una reserva con la asistencia ya registrada';
  end if;

  update public.reservas set estado = 'cancelada', cancelada_en = now() where id = p_reserva_id returning * into v_reserva;

  if v_estado_original = 'confirmada' then
    select * into v_cliente from public.clientes where id = v_reserva.cliente_id;
    select * into v_plan from public.planes where id = v_cliente.plan_id;

    -- El credito consumido al reservar NO se devuelve nunca al bono de origen.
    -- Cancelando con 24h+ de antelacion la compensacion es el bono de
    -- recuperacion, y solo tiene sentido para quien paga por creditos.
    if v_plan.tipo = 'bono' and v_fecha_hora_sesion >= now() + interval '24 hours' then
      v_tope_recuperacion := case when v_cliente.dias_semana_habituales >= 3 then 2 else 1 end;

      select count(*) into v_recuperaciones_mes from public.bonos_cliente
        where cliente_id = v_reserva.cliente_id
          and tipo = 'recuperacion'
          and date_trunc('month', fecha_compra) = date_trunc('month', public.hoy_en_espana());

      if v_recuperaciones_mes < v_tope_recuperacion then
        insert into public.bonos_cliente (cliente_id, plan_id, tipo, creditos_totales, creditos_usados, fecha_compra, fecha_caducidad, activo)
        values (v_reserva.cliente_id, null, 'recuperacion', 1, 0, public.hoy_en_espana(), (public.hoy_en_espana() + interval '14 days')::date, true);
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
            and (fecha_caducidad is null or fecha_caducidad >= public.hoy_en_espana())
            and (creditos_totales - creditos_usados) > 0
          order by fecha_caducidad asc nulls last, fecha_compra asc
          limit 1;
        if not found then
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
