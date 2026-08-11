-- 0013_hoy_en_espana_rpc.sql
-- reservar_sesion y cancelar_reserva comparaban contra current_date, que
-- resuelve en la zona horaria de la sesion de Postgres (UTC en Supabase).
-- Espana va por delante de UTC (+1 invierno, +2 verano): entre medianoche y
-- la 1-2 de la manana en horario local, current_date en el servidor todavia
-- marca el dia anterior. La capa de aplicacion ya se corrigio para calcular
-- "hoy" en Europe/Madrid (ver lib/fechas.ts); esta migracion hace lo mismo en
-- las RPCs para que ambos lados esten de acuerdo. Sin esto, app/cliente/page.tsx
-- podia ofrecer como reservable una sesion a 22 dias vista (hoy_en_espana + 21)
-- que reservar_sesion rechazaba igualmente por estar fuera de la ventana de
-- 3 semanas en UTC — exactamente el fallo que la Tarea 10 (Parte A) existia
-- para evitar, solo que reaparecido un nivel mas abajo.
--
-- No cambia ninguna regla de negocio acordada (ventana de 3 semanas, tope
-- mensual de recuperaciones, caducidad de 14 dias del bono de recuperacion,
-- criterio de vigencia de bonos): solo el dia de calendario contra el que se
-- evaluan.
--
-- reservar_sesion y cancelar_reserva son las unicas funciones con
-- current_date en su definicion viva (ambas redefinidas por ultima vez en
-- 0010_fix_reglas_cancelacion_y_copia.sql; 0011 y 0012 no las tocan). Se
-- redefinen aqui a partir de ese cuerpo, cambiando solo current_date por
-- public.hoy_en_espana(). crear_bono ya recibe la fecha de compra como
-- parametro desde la aplicacion (tambien corregida a Europe/Madrid) y no usa
-- current_date, asi que no necesita cambios. Los usos de now() en ambas
-- funciones comparan contra un instante real (fecha + hora_inicio, o now() +
-- interval), no contra un dia de calendario, y son correctos tal cual.

create or replace function public.hoy_en_espana()
returns date
language sql
stable
as $$
  select (now() at time zone 'Europe/Madrid')::date;
$$;

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
  if (v_sesion.fecha + v_clase.hora_inicio) < now() then
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
  v_fecha_hora_sesion timestamp;
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
  v_fecha_hora_sesion := v_sesion.fecha + v_clase.hora_inicio;

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
