-- 0017_correccion_cancelacion_y_caducidad_bono.sql
-- Elena confirmo por audio el 2026-08-14 que la regla de cancelacion que
-- llevabamos construida estaba invertida (brief-app-centro-entrenamiento.md
-- punto 9). Regla correcta:
--   - Clienta de BONO, cancela >=24h: se devuelve el credito que se
--     consumio al reservar. No se emite bono de recuperacion ni cuenta
--     contra ningun tope.
--   - Clienta de BONO, cancela <24h: el credito se pierde (sin cambios,
--     ya era el comportamiento).
--   - Clienta de MENSUALIDAD, cancela >=24h: se emite un bono de
--     recuperacion que caduca el ultimo dia del mes natural en que se
--     genera (no un plazo fijo de dias), con tope mensual segun
--     dias_semana_habituales (1/mes si 1-2 dias, 2/mes si 3+). Antes esta
--     rama estaba condicionada a plan.tipo = 'bono'; ahora es 'mensual'.
--   - Clienta de MENSUALIDAD, cancela <24h: no pasa nada (una mensual no
--     consume creditos, no hay nada que compensar).
--
-- Para devolver el credito exacto de una clienta de bono hace falta saber
-- que bono se le descuento al reservar -- hasta ahora reservar_sesion
-- elegia un bono y le restaba credito sin dejar rastro en la reserva.

alter table public.reservas add column bono_id uuid references public.bonos_cliente(id);

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

  -- Una sesion cerrada existe pero no es reservable por la clienta: es un hueco
  -- donde Elena mete gente a mano, o una clase fija que ha cerrado. El admin si
  -- puede reservar en ella, que es precisamente para lo que sirve.
  if not v_es_admin and not v_sesion.abierta then
    raise exception 'Esta sesion no esta abierta para reservas';
  end if;

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

  -- Si la clienta esta asignada a un entrenador concreto, solo puede reservar
  -- sus clases. Filtrar solo en la pantalla no bastaria: la RPC es la unica
  -- frontera real. El admin queda exento, que es como mete a alguien donde
  -- haga falta.
  if not v_es_admin
     and v_cliente.entrenador_restringido_id is not null
     and v_clase.entrenador_id <> v_cliente.entrenador_restringido_id then
    raise exception 'Esta clase no es de tu entrenador';
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

  -- bono_id solo se graba cuando de verdad se descuenta un credito (confirmada
  -- + plan de bono): es lo que permite a cancelar_reserva devolver el credito
  -- exacto en vez de adivinar de que bono salio.
  insert into public.reservas (sesion_id, cliente_id, estado, bono_id)
  values (
    p_sesion_id, p_cliente_id, v_estado,
    case when v_estado = 'confirmada' and v_plan.tipo = 'bono' then v_bono.id else null end
  )
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

    if v_plan.tipo = 'bono' then
      -- Cancelar con 24h+ de antelacion devuelve el credito exacto que se
      -- desconto al reservar. Con menos de 24h no se toca nada: el credito
      -- ya consumido se queda perdido.
      if v_fecha_hora_sesion >= now() + interval '24 hours' and v_reserva.bono_id is not null then
        update public.bonos_cliente set creditos_usados = creditos_usados - 1 where id = v_reserva.bono_id;
      end if;
    elsif v_plan.tipo = 'mensual' and v_fecha_hora_sesion >= now() + interval '24 hours' then
      v_tope_recuperacion := case when v_cliente.dias_semana_habituales >= 3 then 2 else 1 end;

      select count(*) into v_recuperaciones_mes from public.bonos_cliente
        where cliente_id = v_reserva.cliente_id
          and tipo = 'recuperacion'
          and date_trunc('month', fecha_compra) = date_trunc('month', public.hoy_en_espana());

      if v_recuperaciones_mes < v_tope_recuperacion then
        -- Corregido el 2026-08-14: caduca el ultimo dia del mes natural en
        -- que se genera, no a un plazo fijo de dias desde la fecha.
        insert into public.bonos_cliente (cliente_id, plan_id, tipo, creditos_totales, creditos_usados, fecha_compra, fecha_caducidad, activo)
        values (
          v_reserva.cliente_id, null, 'recuperacion', 1, 0, public.hoy_en_espana(),
          (date_trunc('month', public.hoy_en_espana()) + interval '1 month' - interval '1 day')::date,
          true
        );
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
        update public.reservas set estado = 'confirmada', bono_id = v_bono_siguiente.id where id = v_siguiente.id;
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

-- crear_bono gana un parametro opcional para que Elena pueda fijar ella la
-- caducidad de un bono que asigna a mano (igual que hacia en Harbiz), en vez
-- de que siempre se calcule sola (+3 meses normal, fin de mes recuperacion).
-- Cambia el numero de argumentos, asi que hay que borrar la firma vieja para
-- no dejar dos versiones de crear_bono coexistiendo.
drop function if exists public.crear_bono(uuid, uuid, integer, date, tipo_bono_enum);

create or replace function public.crear_bono(
  p_cliente_id uuid,
  p_plan_id uuid,
  p_creditos_totales integer,
  p_fecha_compra date,
  p_tipo tipo_bono_enum default 'normal',
  p_fecha_caducidad date default null
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
    v_fecha_caducidad := coalesce(p_fecha_caducidad, (p_fecha_compra + interval '3 months')::date);
    v_deuda_aplicada := least(p_creditos_totales, v_cliente.deuda_creditos);
    v_creditos_netos := p_creditos_totales - v_deuda_aplicada;
    update public.clientes set deuda_creditos = deuda_creditos - v_deuda_aplicada where id = p_cliente_id;
  else
    -- Mismo criterio que la recuperacion generada por cancelar_reserva:
    -- ultimo dia del mes natural de la fecha de compra, no un plazo fijo.
    v_fecha_caducidad := coalesce(
      p_fecha_caducidad,
      (date_trunc('month', p_fecha_compra) + interval '1 month' - interval '1 day')::date
    );
    v_creditos_netos := p_creditos_totales;
  end if;

  insert into public.bonos_cliente (cliente_id, plan_id, tipo, creditos_totales, creditos_usados, fecha_compra, fecha_caducidad, activo)
  values (p_cliente_id, p_plan_id, p_tipo, v_creditos_netos, 0, p_fecha_compra, v_fecha_caducidad, true)
  returning * into v_bono;

  return v_bono;
end;
$$;

revoke all on function public.crear_bono(uuid, uuid, integer, date, tipo_bono_enum, date) from public;
grant execute on function public.crear_bono(uuid, uuid, integer, date, tipo_bono_enum, date) to authenticated;

-- copiar_semana ya no copia ninguna reserva (ni de bono ni de mensualidad):
-- solo genera las sesiones (dia/hora/aforo/entrenador via clase_id) de la
-- semana destino. Elena confirmo que copiar reservas era una sorpresa, no lo
-- que esperaba de "copiar la semana".
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
    end if;
  end loop;

  return v_sesiones_creadas;
end;
$$;

revoke all on function public.copiar_semana(date, date) from public;
grant execute on function public.copiar_semana(date, date) to authenticated;
