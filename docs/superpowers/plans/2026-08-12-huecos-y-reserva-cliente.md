# Rejilla de huecos y nueva reserva de la clienta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Elena pueda abrir los huecos de su horario (para un día suelto o de forma fija) y meter gente en horas cerradas, y que la clienta reserve desde una pantalla usable en móvil en vez de un muro de 150 tarjetas.

**Architecture:** Se añade la rejilla de franjas horarias como tabla propia (no se puede deducir de las clases, porque los huecos de mediodía no tienen ninguna). Abrir un hueco se apoya en `clases.recurrente`, que existía sin significado: recurrente es horario fijo, no recurrente es un día suelto. La reservabilidad por parte de la clienta pasa a un campo `sesiones.abierta`, comprobado dentro de `reservar_sesion` como el resto de guardas. La pantalla de la clienta pasa a tira de días + horas del día elegido.

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), Supabase Postgres (RLS + RPCs `security definer`), Tailwind, Vitest (tests de integración contra el proyecto Supabase real).

**Diseño de referencia:** `docs/superpowers/specs/2026-08-12-huecos-y-reserva-cliente-design.md`

## Global Constraints

- SQL nuevo siempre en migración nueva, nunca editando una aplicada. Las definiciones **vivas** son: `reservar_sesion` y `cancelar_reserva` en `0014`, `marcar_asistencia` en `0014`, `copiar_semana` en `0011`, `crear_bono` en `0008`. Redefinir siempre desde el cuerpo vivo, verificándolo antes con `grep -n "^create or replace function" supabase/migrations/*.sql`. Copiar un cuerpo viejo revierte reglas de negocio en silencio.
- Toda RPC: `security definer`, `set search_path = public`, `revoke all ... from public`, `grant execute ... to authenticated`. Autorización dentro del cuerpo.
- Policies RLS: `"{tabla}_{rol}_{alcance}"`. Admin `for all`; entrenador `for select`; cliente `for select` acotado.
- **Nada de fechas en UTC.** Este proyecto lleva cinco rondas de revisión eliminándolas. Usar `hoyEnEspana()` / `instanteEnEspana()` de `lib/fechas.ts` y `public.hoy_en_espana()` en SQL. Está prohibido introducir `new Date().toISOString().slice(0, 10)`.
- **El número exacto de plazas no puede llegar al navegador de la clienta.** El servidor resuelve Libre/Completo y envía booleanos. Vale también para la tira de días: puede decir si un día tiene algún hueco, nunca cuántos.
- Server actions: `"use server"`, retorno `Promise<{ error?: string }>`, `revalidatePath` de cada panel afectado.
- Tests de integración contra el proyecto real, en secuencia, con fixtures propios vía `crearClaseConSesion` y limpieza en `afterAll`. **Los fixtures del seed ocupan de la semana actual a +27 días**; cualquier fixture propio que necesite aislamiento debe salir de ese rango (el test de `copiar_semana` usa +56 días por eso).
- No ejecutar `npm run lint`: recoge artefactos de un worktree viejo y saca miles de errores irrelevantes. Usar `npx eslint app components lib scripts --max-warnings=0`.
- Aplicar migraciones con `npx supabase db push --db-url '<cadena del pooler>' --yes`. **La contraseña se pasa como argumento, nunca escrita en un fichero versionado** — ya se filtró una en este repo. Pedirla al controlador.
- Fuera de alcance: editar o borrar clases del horario fijo, el botón de copiar semana en pantalla, registrar bonos, etiquetas, referidos, Stripe, emails, PWA y la landing.

---

## File Structure

```
supabase/migrations/
  0015_franjas_y_sesion_abierta.sql   (nuevo) — franjas_horarias, sesiones.abierta,
                                       reservar_sesion con la guarda, copiar_semana
                                       filtrando por recurrente

lib/
  database.types.ts        (regenerado)
  types.ts                 (+ FranjaHoraria, Sesion.abierta, Clase.recurrente ya existe)
  supabase/queries.ts      (+ obtenerFranjas)
  actions/sesiones.ts      (+ abrirHueco, cerrarSesion, reabrirSesion)

components/calendario/
  rejilla-huecos.tsx       (nuevo — la parrilla franjas x dias del panel de Elena)
  abrir-hueco-dialogo.tsx  (nuevo — puntual o fijo, aforo, entrenador)
  vista-dia.tsx            (+ cerrar/reabrir la sesion)

components/
  horario-cliente.tsx      (reescrito — tira de dias + horas del dia)

app/
  admin/clases/page.tsx        (+ rejilla y datos que necesita)
  entrenador/clases/page.tsx   (rejilla en solo lectura)
  cliente/page.tsx             (datos para la tira de dias)

scripts/seed.ts            (+ las 15 franjas)

tests/integration/
  rpc-sesion-abierta.test.ts   (nuevo)
  rpc-copiar-semana.test.ts    (+ no propaga clases no recurrentes)
```

---

### Task 1: Migración 0015 — franjas, sesión abierta y las dos RPCs

**Files:**
- Create: `supabase/migrations/0015_franjas_y_sesion_abierta.sql`

**Interfaces:**
- Produces: tabla `public.franjas_horarias(id, hora_inicio, hora_fin, orden)` con sus policies; `public.sesiones.abierta boolean not null default true`; `reservar_sesion` rechazando sesiones cerradas para no-admin; `copiar_semana` copiando solo clases recurrentes.

- [ ] **Step 1: Verificar qué definición está viva antes de copiar nada**

Run: `grep -n "^create or replace function" supabase/migrations/*.sql`
Expected: confirma que `reservar_sesion` está por última vez en `0014` y `copiar_semana` en `0011`. Anotar el resultado en el informe. **No copiar de `0008` ni de `0010`** — están superadas.

- [ ] **Step 2: Escribir la migración**

Partir de los cuerpos vivos y aplicar solo los cambios descritos. La cabecera:

```sql
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
```

Después, `create or replace` de las dos funciones:

**`reservar_sesion`** — copiar el cuerpo vivo de `0014` y añadir, justo después de cargar `v_clase` y antes de la comprobación de sesión pasada:

```sql
  -- Una sesion cerrada existe pero no es reservable por la clienta: es un hueco
  -- donde Elena mete gente a mano, o una clase fija que ha cerrado. El admin si
  -- puede reservar en ella, que es precisamente para lo que sirve.
  if not v_es_admin and not v_sesion.abierta then
    raise exception 'Esta sesion no esta abierta para reservas';
  end if;
```

Y, más abajo, después de cargar `v_cliente` y comprobar que no está de baja:

```sql
  -- Si la clienta esta asignada a un entrenador concreto, solo puede reservar
  -- sus clases. Filtrar solo en la pantalla no bastaria: la RPC es la unica
  -- frontera real. El admin queda exento, que es como mete a alguien donde
  -- haga falta.
  if not v_es_admin
     and v_cliente.entrenador_restringido_id is not null
     and v_clase.entrenador_id <> v_cliente.entrenador_restringido_id then
    raise exception 'Esta clase no es de tu entrenador';
  end if;
```

**Cambiar la restriccion de una clienta no cancela sus reservas anteriores** — decision explicita, para que tocar una ficha no le vacie clases sin querer ni le cueste creditos. La guarda solo afecta a reservas nuevas.

**`copiar_semana`** — copiar el cuerpo vivo de `0011` y cambiar el `select` del bucle exterior para excluir las clases no recurrentes:

```sql
  for v_sesion_origen in
    select s.* from public.sesiones s
      join public.clases c on c.id = s.clase_id
      where s.fecha >= p_fecha_origen and s.fecha < p_fecha_origen + 7
        and c.recurrente = true
      order by s.fecha asc
  loop
```

El resto del cuerpo, idéntico. Terminar con los `revoke`/`grant` de ambas funciones, con sus firmas exactas.

- [ ] **Step 3: Aplicar**

Pedir al controlador la cadena del pooler y ejecutar:
`npx supabase db push --db-url '<cadena>' --yes`
Expected: aplica `0015` sin errores. Un `--dry-run` posterior devuelve `upToDate`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0015_franjas_y_sesion_abierta.sql
git commit -m "feat: franjas horarias, sesiones abiertas o cerradas, y copiar solo el horario fijo"
```

---

### Task 2: Tipos, consultas y las franjas en el seed

**Files:**
- Modify: `lib/database.types.ts` (regenerado)
- Modify: `lib/types.ts`
- Modify: `lib/supabase/queries.ts`
- Modify: `scripts/seed.ts`

**Interfaces:**
- Produces: `FranjaHoraria` en `lib/types.ts`; `Sesion.abierta: boolean`; `obtenerFranjas(): Promise<FranjaHoraria[]>`; las 15 franjas sembradas.

- [ ] **Step 1: Regenerar tipos**

Run: `npx supabase gen types typescript --project-id pdvpruktssojuicwhhlt --schema public > lib/database.types.ts`

Comprobar que el fichero **no** empieza con un BOM (una redirección de PowerShell lo introdujo una vez). Si aparece, quitarlo.

- [ ] **Step 2: Añadir a `lib/types.ts`**

```ts
export interface FranjaHoraria {
  id: string;
  horaInicio: string;
  horaFin: string;
  orden: number;
}
```

Y añadir `abierta: boolean;` a la interfaz `Sesion`.

- [ ] **Step 3: Añadir la consulta a `lib/supabase/queries.ts`**

Añadir `FranjaHoraria` al `import type` de cabecera, incluir `abierta` en el `select` y el mapeo de `obtenerSesiones`, y al final del fichero:

```ts
export async function obtenerFranjas(): Promise<FranjaHoraria[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("franjas_horarias")
    .select("id, hora_inicio, hora_fin, orden")
    .order("orden", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((f) => ({
    id: f.id,
    horaInicio: f.hora_inicio.slice(0, 5),
    horaFin: f.hora_fin.slice(0, 5),
    orden: f.orden,
  }));
}
```

- [ ] **Step 4: Sembrar las 15 franjas**

En `scripts/seed.ts` hay ya una constante `FRANJAS` con las 12 bandas que tienen clases. La rejilla del centro tiene **15**: faltan las tres de mediodía, que no tienen ninguna clase y son justo las que Elena puede abrir.

Insertar en `franjas_horarias` estas 15, con `orden` 1..15 en este orden:

`07:00-07:50`, `07:50-08:40`, `08:40-09:30`, `09:30-10:20`, `11:10-12:00`, `12:00-12:50`, `13:00-13:50`, `13:50-14:40`, `14:40-15:30`, `16:00-16:50`, `16:50-17:40`, `17:40-18:30`, `18:30-19:20`, `19:20-20:10`, `20:10-21:00`

Dejar la constante `FRANJAS` existente como está: sigue definiendo qué clases se crean. Añadir una constante separada para la rejilla, con un comentario que explique por qué son dos listas distintas (una son las clases del horario fijo, la otra la rejilla completa del centro).

Añadir también `franjas_horarias` a la lista de tablas de `scripts/reset-dev.ts`, en el orden correcto de claves foráneas.

- [ ] **Step 5: Resembrar y verificar**

Run: `npm run reset:dev -- si-borrar-todo && npm run seed`
Expected: termina sin errores. Comprobar con una consulta que hay 15 franjas y 51 clases.

- [ ] **Step 6: Verificar compilación**

Run: `npx tsc --noEmit && npx eslint app components lib scripts --max-warnings=0`
Expected: ambos limpios.

- [ ] **Step 7: Commit**

```bash
git add lib scripts
git commit -m "feat: exponer las franjas horarias y el estado abierta de las sesiones"
```

---

### Task 3: Tests de la sesión cerrada y del copiado

**Files:**
- Create: `tests/integration/rpc-sesion-abierta.test.ts`
- Modify: `tests/integration/rpc-copiar-semana.test.ts`

**Interfaces:**
- Consumes: la migración de Task 1 y los helpers de `tests/integration/helpers.ts` (`signInAs`, `crearClaseConSesion`, `borrarClases`, `clienteIdPorEmail`, `instanteMadrid`).

Estas dos reglas son las que más fácilmente se rompen sin que nadie se entere, así que los tests van antes que la interfaz.

- [ ] **Step 1: Crear `tests/integration/rpc-sesion-abierta.test.ts`**

Cubrir:

1. Una clienta **no** puede reservar en una sesión con `abierta = false`; el error menciona que no está abierta para reservas, y no queda ninguna fila en `reservas` para esa sesión.
2. El **admin sí** puede reservar en ella en nombre de una clienta — es justo para lo que sirve.
3. Cerrar una sesión **no afecta a las reservas que ya existían**: la clienta la mantiene y puede cancelarla.
4. Reabrir una sesión cerrada la vuelve reservable por la clienta.

Crear fixtures propios con `crearClaseConSesion` (offset suficiente para caer dentro de la ventana de 3 semanas, p. ej. `+48h`), poner `abierta` con el cliente admin, y limpiar con `borrarClases` en `afterAll`.

Capturar cualquier id que se necesite para limpiar **inmediatamente después** de crearlo, antes de cualquier `expect` que pueda lanzar — si no, un fallo deja filas huérfanas en el proyecto compartido.

- [ ] **Step 2: Añadir a `tests/integration/rpc-copiar-semana.test.ts`**

Un test que demuestre que **una clase no recurrente no se propaga**: crear en la semana origen una clase con `recurrente = false` y su sesión, copiar la semana, y comprobar que en la semana destino **no** existe sesión para esa clase, mientras que las recurrentes sí se copiaron.

Es la regla que el diseño marca como el fallo más fácil de que se cuele: sin ella, un hueco que Elena abrió un martes suelto se repetiría para siempre.

Ese fichero trabaja a +56 días para no chocar con las sesiones del seed (que llegan a +27). Mantenerlo.

- [ ] **Step 2b: Cubrir la restricción de entrenador**

En el mismo fichero nuevo de la Step 1 o en uno aparte, cubrir:

1. Una clienta con `entrenador_restringido_id` puesto **no puede** reservar una clase de otro entrenador; el error menciona que no es de su entrenador.
2. **Sí puede** reservar una clase de su entrenador.
3. Una clienta **sin** restricción (`null`) puede reservar clases de cualquiera.
4. El **admin puede** reservar en nombre de una clienta restringida en una clase de otro entrenador — es la excepción que le permite colocar a alguien donde haga falta.

Restaurar el campo a `null` en `afterAll` si se toca una clienta del seed, o mejor crear la restricción sobre una clienta y deshacerla, para no dejar el seed alterado.

- [ ] **Step 3: Correr la suite dos veces**

Run: `npm run test:integration` (dos veces seguidas)
Expected: verde las dos, salida limpia. La segunda pasada es la que demuestra que los tests limpian lo que crean.

- [ ] **Step 4: Commit**

```bash
git add tests/integration
git commit -m "test: cubrir las sesiones cerradas y que copiar semana ignore los huecos sueltos"
```

---

### Task 4: Acciones de abrir hueco, cerrar y reabrir

**Files:**
- Modify: `lib/actions/sesiones.ts`

**Interfaces:**
- Produces: `abrirHueco(datos): Promise<{ error?: string }>`, `cerrarSesion(sesionId): Promise<{ error?: string }>`, `reabrirSesion(sesionId): Promise<{ error?: string }>`.

- [ ] **Step 1: Añadir las tres acciones**

Seguir el estilo del `ajustarAforoSesion` que ya está en ese fichero: esquema Zod, cliente de servidor, y apoyarse en RLS para la autorización (la única policy de escritura sobre `sesiones` es `sesiones_admin_all`, así que un entrenador recibe 0 filas y se traduce a "No autorizado").

`abrirHueco` recibe día de la semana, hora de inicio y fin, fecha, aforo, entrenador y si es fija o puntual. Hace dos cosas en orden:

1. Inserta en `clases` con `recurrente` según lo elegido.
2. Inserta la `sesion` de esa fecha, con `abierta = true`.

Si el segundo paso falla, **borrar la clase recién creada** antes de devolver el error — dejar una clase sin sesión ensucia el horario fijo de forma invisible. `lib/actions/clientes.ts` tiene ese patrón de deshacer para copiarlo.

Validar que la fecha corresponde de verdad al día de la semana indicado; si no, la sesión aparecería en un día distinto al que Elena pulsó.

`cerrarSesion` y `reabrirSesion` son un `update` de `abierta`.

`revalidatePath` de `/admin/clases`, `/entrenador/clases` y `/cliente` en las tres.

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npx eslint app components lib scripts --max-warnings=0`
Expected: limpios.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/sesiones.ts
git commit -m "feat: acciones para abrir un hueco y cerrar o reabrir una sesion"
```

---

### Task 5: La rejilla de huecos en el panel de Elena

**Files:**
- Create: `components/calendario/rejilla-huecos.tsx`
- Create: `components/calendario/abrir-hueco-dialogo.tsx`
- Modify: `app/admin/clases/page.tsx`
- Modify: `app/entrenador/clases/page.tsx`

**Interfaces:**
- Consumes: `obtenerFranjas` (Task 2), `abrirHueco` (Task 4).
- Produces: `<RejillaHuecos franjas clases sesiones fecha puedeAbrir />` y su diálogo.

- [ ] **Step 1: Crear la rejilla**

Una parrilla de 15 franjas × lunes-sábado para la semana que se esté mirando. Cada celda, uno de tres estados:

- **Clase fija** — hay una clase recurrente ese día y esa franja. Se ve con el estilo de las tarjetas del calendario.
- **Abierta puntualmente** — hay una clase no recurrente. Distinguible de la fija, para que Elena vea de un vistazo qué es excepcional.
- **Hueco** — sin clase. En gris, pulsable si `puedeAbrir`.

Reutilizar el lenguaje visual del resto del calendario (`components/calendario/vista-semana.tsx`, `vista-mes.tsx`, `color-ocupacion.ts`) en vez de inventar otro.

Para Iván (`puedeAbrir = false`) la rejilla se ve pero los huecos no son pulsables.

- [ ] **Step 2: Crear el diálogo de abrir hueco**

Al pulsar un hueco, un diálogo (hay `components/ui/dialog.tsx`) que pide:

- **Solo este día** o **añadir al horario fijo**. Esta elección tiene que quedar visualmente clara: la segunda cambia el horario de todas las semanas siguientes, y confundirlas es el error caro. Redactarlo en esos términos, no como un tecnicismo.
- **Plazas**, por defecto 5, editable.
- **Entrenador**, con la lista de usuarios con rol `entrenador` o `admin`.

Al confirmar, llama a `abrirHueco` y muestra el error si lo hay.

- [ ] **Step 3: Conectar las páginas**

En ambas páginas de clases, añadir la rejilla junto al calendario que ya existe, pasándole las franjas. `puedeAbrir` va a `true` solo en la de admin.

Decidir dónde encaja (pestaña, sección debajo, o dentro de la vista de semana) y explicar la elección en el informe. Lo importante es que no compita con el calendario ni obligue a Elena a elegir entre "ver" y "gestionar".

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npx eslint app components lib scripts --max-warnings=0 && npm run build`
Expected: los tres limpios.

- [ ] **Step 5: Commit**

```bash
git add components/calendario app/admin/clases app/entrenador/clases
git commit -m "feat: rejilla de huecos con apertura puntual o fija"
```

---

### Task 6: Cerrar y reabrir desde la vista de día

**Files:**
- Modify: `components/calendario/vista-dia.tsx`

**Interfaces:**
- Consumes: `cerrarSesion` / `reabrirSesion` (Task 4).

- [ ] **Step 1: Añadir el control**

En la cabecera de cada sesión, y **solo cuando `puedeQuitar`** (que es el indicador de que quien mira es Elena), un control para cerrar la sesión o reabrirla, con su estado actual visible.

Cerrar una sesión con gente ya apuntada **no las echa** — sus reservas siguen. Que el texto lo deje claro, o Elena pensará que está vaciando la clase.

No tocar nada más de ese componente: la asistencia, el botón de quitar y su confirmación condicional están cubiertos por revisiones anteriores y no entran aquí.

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npx eslint app components lib scripts --max-warnings=0 && npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/calendario/vista-dia.tsx
git commit -m "feat: cerrar y reabrir una sesion desde la vista de dia"
```

---

### Task 6b: Botón de copiar la semana

**Files:**
- Modify: `components/calendario/rejilla-huecos.tsx`

**Interfaces:**
- Consumes: `copiarSemana(fechaOrigen, fechaDestino)` de `lib/actions/horarios.ts`, que ya existe y está probada.

**Por qué esta tarea existe:** las clases del horario fijo son la plantilla; lo que una clienta reserva son las **sesiones**, que hay que generar. Hoy solo existen porque el seed creó cuatro semanas. Pasadas esas, el calendario se vaciaría y Elena no tendría forma de arreglarlo desde la app — `copiar_semana` funciona pero no tiene botón. Sin esto la aplicación no se sostiene sola.

- [ ] **Step 1: Añadir el botón**

En la cabecera de la rejilla, junto a la navegación de semana, un botón que copie la semana mostrada a la siguiente. Llama a `copiarSemana(primerDiaDeLaSemanaMostrada, esaFecha + 7)`.

**Decir en la interfaz lo que realmente hace**, porque no es solo "crear huecos vacíos": copia las sesiones **y apunta a las clientas de cuota mensual** que estaban en la semana origen. Las de bono reservan ellas. Elena tiene que saber que va a colocar gente, no solo horas.

Es una acción segura de repetir: la RPC usa `on conflict do nothing`, así que copiar dos veces no duplica nada. Aun así, mostrar el resultado — `sesionesCreadas` viene en la respuesta — para que Elena sepa si hizo algo o si esa semana ya estaba.

Usar el `toast` que ya existe (`components/ui/toast.tsx`, como en `lista-clientes.tsx`) para el resultado, y el `useTransition` que el componente ya usa.

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npx eslint app components lib scripts --max-warnings=0 && npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/calendario/rejilla-huecos.tsx
git commit -m "feat: boton para copiar la semana mostrada a la siguiente"
```

---

### Task 7: Nueva pantalla de reserva de la clienta

**Files:**
- Modify: `components/horario-cliente.tsx` (reescrito)
- Modify: `app/cliente/page.tsx`

**Interfaces:**
- Produces: `<HorarioCliente clienteId hoy limite dias sesionesLibres clases sesiones reservas />`, donde `dias` es lo que necesita la tira.

- [ ] **Step 1: Preparar los datos en el servidor**

En `app/cliente/page.tsx`, además de lo que ya calcula:

- Filtrar fuera las sesiones con `abierta = false` **salvo** que la clienta tenga reserva en ellas. Es la decisión del diseño: ve su reserva, no la hora suelta.
- Si la clienta tiene `entrenadorRestringidoId`, filtrar fuera las clases de otros entrenadores — con la misma excepción: las sesiones donde ya tiene reserva se siguen viendo, porque cambiarle el entrenador no le cancela lo que ya tenía.
- Construir la lista de días de la ventana con, por cada uno, si tiene alguna sesión reservable y si la clienta ya tiene reserva ese día. **Un booleano por día, nunca un conteo** — la tira no puede filtrar cuántos huecos quedan.

- [ ] **Step 2: Reescribir el componente**

Dos zonas:

- **Tira de días**, deslizable horizontalmente, de hoy al final de la ventana de tres semanas. Cada día con su abreviatura y número. Los días sin ninguna sesión reservable, apagados. Los días donde la clienta ya tiene reserva, marcados. Arranca en el primer día con hueco. Debe funcionar con el pulgar: es una PWA de móvil.
- **Horas del día elegido**: lista vertical con hora, entrenador y **Libre / Completo**. Nunca cifras. Si la clienta ya tiene reserva ese día, arriba con su botón de cancelar.

Mantener intactos: la ventana de tres semanas, el descarte de sesiones ya empezadas vía `instanteEnEspana`, y que `hoy` llegue como prop del servidor sin recalcularse en el cliente.

Reutilizar el lenguaje visual del rediseño (`components/ui/*`, animaciones, toasts) en vez de inventar otro.

- [ ] **Step 3: Aviso al cancelar una hora cerrada**

Si la reserva que se va a cancelar está en una sesión cerrada, avisar antes de confirmar de que **no podrá volver a cogerla ella sola** y tendrá que hablar con Elena. No pierde el crédito si cancela con más de 24h, pero sí la plaza.

- [ ] **Step 4: Comprobar que no se escapa el aforo**

Run: `grep -n "ocupacion\|aforo\|libres" components/horario-cliente.tsx`
Expected: ninguna cifra ni nada que permita reconstruirla; solo booleanos y texto. Anotar en el informe qué se buscó y qué salió.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npx eslint app components lib scripts --max-warnings=0 && npm run build && npm run test:integration`
Expected: todo limpio y la suite verde.

- [ ] **Step 6: Commit**

```bash
git add components/horario-cliente.tsx app/cliente/page.tsx
git commit -m "feat: la clienta reserva eligiendo dia y luego hora"
```

---

### Task 7b: Asignar entrenador desde la ficha de la clienta

**Files:**
- Modify: `lib/validaciones.ts`
- Modify: `lib/actions/clientes.ts`
- Modify: `components/cliente-form.tsx`
- Modify: `components/ficha-cliente.tsx`

**Interfaces:**
- Consumes: `clientes.entrenador_restringido_id` (Task 1), `Cliente.entrenadorRestringidoId` (Task 2).

- [ ] **Step 1: Añadir el campo al formulario**

En `components/cliente-form.tsx`, un selector con la lista de usuarios con rol `entrenador` o `admin`, más una opción vacía que significa **sin restricción, ve a todos**. Redactarlo en los términos de Elena: no "restricción", sino algo como "Entrena con" y una opción "Cualquiera".

Ampliar `clienteFormSchema` en `lib/validaciones.ts` y el esquema de `actualizarCliente` para aceptar el campo (uuid o null), y persistirlo en `altaCliente` y `actualizarCliente`.

`altaCliente` ya tiene un patrón de deshacer si un paso posterior falla; no romperlo al añadir el campo.

- [ ] **Step 2: Mostrarlo en la ficha**

En `components/ficha-cliente.tsx`, junto al plan y los días por semana, mostrar con quién entrena, o "Cualquiera" si no tiene restricción.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npx eslint app components lib scripts --max-warnings=0 && npm run build && npm run test:integration`
Expected: todo limpio y la suite verde — `altaCliente` y `actualizarCliente` están cubiertos por los tests de integración.

- [ ] **Step 4: Commit**

```bash
git add lib components
git commit -m "feat: asignar a una clienta el entrenador con el que entrena"
```

---

### Task 8: Repaso manual

**Files:** ninguno — es verificación.

- [ ] **Step 1: Arrancar**

Run: `npm run dev`

- [ ] **Step 2: Recorrer**

Con el acceso rápido de `/login`:

1. **Elena → Clases**: la rejilla muestra las 51 clases fijas y los huecos en gris, incluidas las tres franjas de mediodía y el sábado entero.
2. Abrir un hueco **solo para ese día**. Aparece en el calendario. La semana siguiente ese hueco sigue vacío.
3. Abrir un hueco **como fijo**. Comprobar que queda en el horario.
4. **Cerrar** una clase con gente apuntada: las reservas siguen ahí.
5. Entrar como **esa clienta**: ve su reserva, pero esa hora no está en el listado para reservar.
6. **Iván → Clases**: ve la rejilla, no puede abrir huecos.
7. **María**: la tira de días, cambiar de día, reservar, cancelar. Nunca ve un número de plazas.
8. Asignarle a una clienta el entrenador Iván desde su ficha, y comprobar que en su app solo le salen horas de Iván. Quitarle la restricción y comprobar que vuelve a verlas todas.
9. Asignarle un entrenador a una clienta **que ya tenga una reserva con el otro**: esa reserva debe seguir ahí, no cancelarse.

- [ ] **Step 3: Anotar lo que falle**

Arreglar antes de dar por buena la tarea. Lo que necesite decisión de producto, reportarlo en vez de improvisar.

---

## Self-Review Notes

- **Cobertura del diseño**: franjas (Tasks 1-2), sesión abierta/cerrada con su guarda (Tasks 1, 4, 6), significado de `recurrente` y el filtro en `copiar_semana` (Task 1, probado en Task 3), rejilla con apertura puntual o fija (Tasks 4-5), rediseño de la pantalla de la clienta con el aviso al cancelar (Task 7).
- **Los dos riesgos que el diseño marca** tienen cobertura explícita: la propagación de clases sueltas al copiar (Task 3, Step 2) y la fuga del aforo (Task 7, Step 4).
- **Fuera a propósito**: editar o borrar clases del horario fijo, el botón de copiar semana en pantalla, registrar bonos, etiquetas, referidos, Stripe, emails, PWA, landing.
- **Consistencia**: `franjas_horarias` se crea en Task 1, se tipa y consulta en Task 2, se siembra en Task 2 y se consume en Task 5. `sesiones.abierta` se crea en Task 1, se tipa en Task 2, se comprueba en la RPC en Task 1, se escribe en Task 4, se muestra en Task 6 y se filtra en Task 7.
- **Sin tests de componentes**: el proyecto no tiene esa infraestructura y no se monta aquí. La lógica nueva vive en la migración y va cubierta por tests de integración reales; las pantallas se verifican a mano en Task 8.
