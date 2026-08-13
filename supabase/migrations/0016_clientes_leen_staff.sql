-- 0016_clientes_leen_staff.sql
-- La nueva pantalla de reserva de la clienta (huecos-y-reserva-cliente,
-- Task 7) muestra el entrenador de cada clase. Con las policies actuales,
-- users_cliente_select_own solo deja ver la fila propia: cualquier lookup de
-- un entrenador o de Elena desde una sesion de clienta vuelve vacio, y por
-- eso el nombre no se resolvia (el fallback tapaba el problema en vez de
-- arreglarlo).
--
-- Se anade una policy adicional -- las policies de un mismo comando en la
-- misma tabla se combinan con OR, no se sustituyen -- que deja a una clienta
-- autenticada leer las filas de staff (rol entrenador o admin). Quien da
-- las clases es informacion publica del centro (nadie reserva a ciegas),
-- no un dato personal de otra clienta: no es equivalente a poder leer las
-- reservas o los pagos de otra persona, que siguen bloqueados.
--
-- Esta policy da acceso a la fila entera, columnas incluidas (email,
-- telefono): Postgres RLS no recorta columnas, solo filas, y el resto del
-- esquema tampoco usa vistas para eso. Decision tomada: no vale la pena una
-- vista solo para este caso -- el equipo son dos personas (Elena e Ivan) en
-- un centro donde la clienta ya trata con ambos en persona, asi que su
-- telefono y email no son un secreto para las clientas del centro. Lo que si
-- se evita es que esos datos completos crucen a un componente cliente sin
-- necesitarlo: app/cliente/page.tsx recorta a {id, nombre} antes de pasarlos
-- a HorarioCliente, que es lo unico que la pantalla necesita mostrar.

create policy "users_cliente_select_staff" on public.users for select to authenticated
  using (public.auth_rol() = 'cliente' and rol in ('entrenador', 'admin'));
