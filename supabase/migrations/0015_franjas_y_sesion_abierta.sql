-- 0015_franjas_y_sesion_abierta.sql
-- El centro tiene una rejilla de franjas horarias de la que 51 celdas son
-- clases fijas; el resto son huecos que solo Elena puede abrir. Faltaban dos
-- cosas para poder representarlo:
--
-- 1. Las franjas como tal. No se pueden deducir de las clases existentes: las
--    tres de mediodia (11:10, 12:00, 13:00) no tienen ninguna clase, y son
--    justo las que Elena querria abrir.
--
-- 2. Un estado por sesion de "abierta a las clientas" o "solo Elena". Con el,
--    Elena puede meter a alguien en un hueco sin abrirlo a nadie mas, y
--    tambien cerrar una clase fija concreta (lo que la propuesta comercial
--    llamaba "bloquear clases" y dejaba para la Fase 2, pero resulta ser el
--    funcionamiento diario).
--
-- Ademas se le da por fin significado a clases.recurrente: recurrente es
-- horario fijo, no recurrente es un hueco abierto para un dia suelto. Eso
-- obliga a que copiar_semana filtre por el campo: sin ese filtro, un hueco
-- abierto un martes concreto se repetiria todas las semanas para siempre.
--
-- Cuerpos vivos verificados con
-- `grep -n "^create or replace function" supabase/migrations/*.sql`:
--   - reservar_sesion: redefinida por ultima vez en 0014.
--   - copiar_semana: redefinida por ultima vez en 0011 (nada la toca despues).
-- reservar_sesion se redefine aqui a partir del cuerpo vivo de 0014, anadiendo
-- las dos comprobaciones nuevas (sesion cerrada, entrenador restringido).
-- copiar_semana se redefine aqui a partir del cuerpo vivo de 0011, cambiando
-- solo el select del bucle exterior para excluir clases no recurrentes.
-- cancelar_reserva no cambia en este task: no se toca aqui.

create table public.franjas_horarias (
  id uuid primary key default gen_random_uuid(),
  hora_inicio time not null,
  hora_fin time not null,
  orden integer not null,
  unique (hora_inicio, hora_fin)
);

alter table public.franjas_horarias enable row level security;

-- La clienta no necesita saber que huecos existen: solo ve las clases a las
-- que puede apuntarse.
create policy "franjas_horarias_admin_all" on public.franjas_horarias for all to authenticated
  using (public.auth_rol() = 'admin') with check (public.auth_rol() = 'admin');
create policy "franjas_horarias_entrenador_select" on public.franjas_horarias for select to authenticated
  using (public.auth_rol() = 'entrenador');

alter table public.sesiones add column abierta boolean not null default true;

-- Restriccion de entrenador por clienta. Ivan lleva sobre todo gente mayor o
-- con alguna patologia; una clienta asignada a el solo debe ver y poder
-- reservar sus horas. Se modela como FK nullable en vez de un enum de dos
-- valores porque el centro puede incorporar mas entrenadores sin cambiar el
-- esquema. `null` = sin restriccion, ve a todos.
alter table public.clientes
  add column entrenador_restringido_id uuid references public.users(id);

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
