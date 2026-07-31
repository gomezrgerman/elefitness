# Elefitness — Sprint 1+2 real con Supabase (sin Stripe) — Design Spec

**Fecha:** 2026-07-31
**Estado:** Aprobado por Germán

## Contexto y objetivo

Germán quiere presentarle a Elena el lunes 2026-08-03 el proyecto real
funcionando contra una base de datos Supabase de verdad (no el mock en
memoria del demo anterior), para acelerar su decisión de aprobar el
proyecto. Elena aún no ha aprobado el proyecto — este trabajo es
preparación, no un Sprint 1 confirmado por contrato.

Esto cubre el Sprint 1 completo de `Claude.MD` (Supabase schema + RLS +
auth 3 roles + CRUD clientes) más el núcleo de Sprint 2 (calendario de
clases, reservas con aforo y lista de espera reales), y una parte de
Sprint 3 limitada a registrar pagos manualmente (sin checkout de Stripe
todavía). Marca esos sprints en `Claude.MD` solo cuando este trabajo esté
verificado y Elena lo haya visto — no antes.

Sustituye la capa de datos del demo anterior (`lib/mock-store.tsx` +
`lib/mock-data.ts`) por Supabase real, reutilizando la UI existente
(`ListaClientes`, `CalendarioSemanal`, `TablaCobros`, `HorarioCliente`,
`MiPlan`, `ClienteForm`, `BadgeEstado`) con los cambios mínimos necesarios
para leer/escribir contra Postgres en vez del Context en memoria.

## Alcance

### Dentro

- Proyecto Supabase real ya provisionado (`pdvpruktssojuicwhhlt`),
  confirmado vacío (sin tablas existentes) antes de empezar.
- Schema Postgres con las tablas de `Claude.MD`: `centro, users, clientes,
  planes, clases, reservas, pagos, bonos_cliente`. `public.users.id`
  referencia `auth.users.id` (mismo UUID, sin tabla de perfiles separada).
- RLS en todas las tablas, por rol:
  - **admin**: acceso completo (`SELECT/INSERT/UPDATE/DELETE`).
  - **entrenador**: solo `SELECT` en todo — sin escritura.
  - **cliente**, en tablas de referencia (`centro`, `planes`, `clases`):
    solo `SELECT` (necesita ver el horario y su plan, no puede crear
    clases ni planes).
  - **cliente**, en tablas propias (`clientes`, `reservas`, `pagos`,
    `bonos_cliente`): solo lee/escribe sus propias filas
    (`clientes.usuario_id = auth.uid()`, y sus `reservas`/`pagos`/
    `bonos_cliente` vía join a su fila de `clientes`) — la escritura
    directa de cliente en `reservas` queda limitada a lo que permiten
    las funciones RPC (ver más abajo), no puede hacer `UPDATE` arbitrario
    de `estado`.
- Auth real con Supabase Auth (`@supabase/ssr`), tres roles. `/login` con
  formulario real de email + contraseña, más un panel "Acceso rápido
  (solo demo)" con botones que inician sesión directamente como cada
  cuenta semilla (Elena, Ivan, Maria, Laura, Sara) para poder cambiar de
  rol rápido durante la presentación.
- Lógica de negocio con riesgo de condición de carrera (aforo, lista de
  espera, crédito de bono) implementada como funciones SQL
  (`reservar_clase`, `cancelar_reserva`) que corren atómicamente en
  Postgres, invocadas vía `supabase.rpc(...)` desde Server Actions.
- CRUD de clientes real (alta/baja/reactivar/editar plan y notas de
  rutina) vía Server Actions con Zod, contra Postgres.
- Calendario semanal de clases con aforo/lista de espera reales.
- Registro manual de pagos (mensual o bono; método stripe/efectivo/
  transferencia) — sin checkout de Stripe todavía, es solo el campo que
  ya existe en el modelo de datos.
- Seeds ficticios (script con `service_role`, ejecutado localmente, nunca
  en el cliente): 1 centro, Elena (admin), Ivan (entrenador), 3 clientas
  curadas (Maria/mensual/confirmada en lunes, Laura/bono/lista de espera
  en miércoles, Sara/mensual/morosa) + 5 clientas de relleno para llenar
  el aforo de miércoles — mismo escenario que el demo anterior, ahora
  persistente en Postgres.
- Tests de integración contra el proyecto Supabase real (no mocks) para:
  aforo lleno → lista de espera; cancelar reserva confirmada → promueve
  la primera en espera; consumo/devolución de crédito de bono al
  reservar/cancelar; RLS deniega lectura cruzada entre clientas y
  escritura desde entrenador.
- Deploy a Vercel con las env vars de Supabase (URL + anon key públicas;
  `service_role` solo en local, nunca en Vercel ni en el bundle cliente).

### Fuera de este trabajo (Sprint 3/4 real, más adelante)

- Checkout de Stripe, suscripciones recurrentes, webhooks de cobro
  fallido/moroso automático.
- Emails transaccionales (Resend).
- PWA (manifest, service worker).
- Migración de datos reales de clientas desde Harbiz — confirmado con
  Germán que este trabajo usa solo datos ficticios; la migración queda
  pendiente de una decisión futura con Elena (pregunta abierta del brief,
  punto 7).
- Panel de administración de contraseñas/invitaciones para clientas
  reales (por ahora las cuentas son solo las semillas ficticias creadas
  por el script).

## Decisiones clave

| Decisión | Elegido | Alternativas descartadas |
|---|---|---|
| Origen de datos | Ficticio (mismo set curado que el demo) | Migrar datos reales de Harbiz (bloqueado: sin acceso, y Germán confirmó que este trabajo es solo ficticio) |
| Dónde vive la lógica de aforo/lista de espera/bono | Funciones SQL (`reservar_clase`, `cancelar_reserva`), `SECURITY DEFINER` con comprobación explícita de propiedad dentro de la función | TypeScript en el Server Action (descartado: sin transacciones multi-tabla fuera de una función SQL, condición de carrera); `SECURITY INVOKER` (descartado: cancelar una reserva promueve la de *otra* clienta en lista de espera, y reservar necesita contar reservas de toda la clase — ninguna de las dos cabe en los permisos propios de una clienta bajo RLS, así que la función necesita privilegio elevado y validar `auth.uid()` a mano) |
| Login para la demo | Formulario real + panel "Acceso rápido (solo demo)" con las 5 cuentas semilla | Solo formulario real sin atajos (descartado: Germán quiere cambiar de rol rápido en vivo); seguir con el selector de click del demo anterior (descartado: ya no habría auth real que enseñar) |
| Pagos | Registro manual (campo `metodo`/`registrado_por`), sin checkout | Integrar Stripe checkout ya (descartado: fuera de plazo para el lunes, y es su propio sprint con sus propias preguntas abiertas del brief) |
| Testing | Tests de integración solo en lo crítico (RPCs de reserva + RLS), resto verificado a mano en navegador | TDD completo con 80% cobertura (descartado por plazo; acordado explícitamente con Germán) |
| Arquitectura de datos en la UI | Server Components (lectura) + Server Actions (escritura), sin Context global | Mantener un Context tipo `mock-store` pero alimentado por Supabase (descartado: duplica estado, complica revalidación, no sigue la convención de `Claude.MD` de Server Actions para mutaciones) |

## Componentes

### Base de datos (`supabase/migrations/`)

- Migración de schema: tablas `centro, users, clientes, planes, clases,
  reservas, pagos, bonos_cliente` con tipos enum de Postgres para
  `rol`, `dia_semana`, `estado_cliente`, `tipo_plan`, `estado_reserva`,
  `metodo_pago`, `estado_pago` (equivalentes a los union types de
  `lib/types.ts` del demo anterior).
- Políticas RLS por tabla y rol (helper SQL `auth_rol()` o subquery a
  `public.users` para leer el rol de `auth.uid()`).
- Funciones RPC `reservar_clase(p_clase_id uuid, p_cliente_id uuid)` y
  `cancelar_reserva(p_reserva_id uuid)` — `SECURITY DEFINER` (necesitan
  leer/escribir filas fuera de lo que RLS permitiría al que llama: contar
  reservas de toda la clase, o promover la reserva de *otra* clienta en
  lista de espera). Cada función comprueba a mano al principio que
  `auth.uid()` corresponde al dueño de `p_cliente_id`/de la reserva (o
  que el rol es `admin`) y lanza una excepción si no, antes de tocar
  ninguna fila — así ningún cliente puede reservar ni cancelar en nombre
  de otro pese al privilegio elevado de la función.
- Script de seed (Node/TS, usa `SUPABASE_SERVICE_ROLE_KEY`, se corre
  local con `npm run seed`, nunca se despliega): crea usuarios en
  `auth.users` vía Admin API + filas correspondientes en `public.users`/
  `clientes`/`clases`/`reservas`/`pagos`/`bonos_cliente`.

### App (`lib/supabase/`)

- `lib/supabase/client.ts` — cliente browser (`createBrowserClient`).
- `lib/supabase/server.ts` — cliente server (`createServerClient`, usa
  cookies de la request).
- `middleware.ts` — refresca la sesión y protege `/admin`, `/entrenador`,
  `/cliente` por rol (redirige a `/login` si no hay sesión o el rol no
  coincide).

### Server Actions (`lib/actions/`)

- `clientes.ts`: `altaCliente`, `bajaCliente`, `reactivarCliente`,
  `actualizarCliente` — validan con Zod, escriben vía el cliente server
  (RLS aplica: solo admin puede ejecutar estas, entrenador falla por
  política).
- `reservas.ts`: `reservarClase`, `cancelarReserva` — llaman a los RPC
  SQL, no tocan las tablas directamente.
- `pagos.ts`: `registrarPago` — alta manual de un pago (admin only por
  RLS).

### UI

Reutiliza los componentes del demo anterior
(`components/lista-clientes.tsx`, `components/calendario-semanal.tsx`,
`components/tabla-cobros.tsx`, `components/horario-cliente.tsx`,
`components/mi-plan.tsx`, `components/cliente-form.tsx`,
`components/badge-estado.tsx`), adaptando la fuente de datos: las páginas
(`app/admin/**/page.tsx`, `app/entrenador/**/page.tsx`,
`app/cliente/page.tsx`) pasan a ser Server Components que hacen
`await supabase.from(...)` y pasan los datos como props; los botones de
acción llaman a los Server Actions en vez de a `useAppStore()`.

Nuevo: `app/login/page.tsx` con el formulario real + el panel de acceso
rápido para la demo.

## Manejo de errores

- Server Actions devuelven `{ error: string }` en vez de lanzar, y los
  componentes cliente muestran el mensaje (mismo patrón que el
  `ClienteForm` actual con `setError`).
- Si `reservar_clase`/`cancelar_reserva` fallan (p. ej. la clase ya no
  existe), el RPC devuelve un error de Postgres que el Server Action
  traduce a un mensaje en español para la UI.
- RLS deniega en vez de lanzar 500: una query que no debería ver nada
  simplemente devuelve una lista vacía (comportamiento estándar de
  Postgres RLS), no hace falta manejo especial.

## Testing

- Framework: Vitest, tests de integración contra el proyecto Supabase
  real (no local, no mocks) usando las cuentas semilla ya creadas.
- Casos cubiertos:
  - `reservar_clase` en una clase con aforo lleno devuelve estado
    `lista_espera`.
  - `cancelar_reserva` de una reserva confirmada promueve la primera en
    `lista_espera` a `confirmada`.
  - Reservar con un bono sin créditos restantes falla.
  - Cancelar consume/devuelve crédito de bono correctamente.
  - RLS: sesión de Maria no puede `SELECT` la fila de `reservas`/`pagos`
    de Laura.
  - RLS: sesión de Ivan (entrenador) recibe error al intentar `INSERT`/
    `UPDATE` en `clientes` o `reservas`.
- Todo lo demás (formularios, layouts, navegación, estilos) se verifica
  a mano en `npm run dev` siguiendo los mismos pasos manuales que ya
  usó el demo anterior, adaptados a login real.

## Deploy

Mismo flujo que el demo anterior (`npx vercel login` / `npx vercel
--prod`, interactivo, lo corre Germán), añadiendo en la configuración de
Vercel las env vars `NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY` se queda
solo en `.env.local` para correr el script de seed en local — no se
sube a Vercel ni se referencia desde código que corra en el cliente.
