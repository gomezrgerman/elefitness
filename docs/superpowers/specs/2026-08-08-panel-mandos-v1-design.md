# Panel de mandos v1 — diseño

**Fecha:** 2026-08-08
**Contexto:** la capa de datos de la Fase 1 está terminada y fusionada a `master`
(migraciones 0006-0011, 35 tests de integración). La lógica de negocio funciona
pero casi no tiene pantallas: no hay forma de marcar asistencia, ni de ver el
historial de una clienta, y la clienta ve datos que Elena pidió ocultarle.

Este diseño cubre lo que se puede construir **sin la respuesta de Elena** sobre
cómo monta su horario. Queda fuera a propósito: crear clases y sesiones, el
botón de copiar semana, y registrar bonos — todas dependen de esa conversación
(ver `proyecto_preguntas_pendientes_elena` en memoria).

## Objetivo

Que Elena e Iván puedan operar el día a día del centro desde la app: ver el
horario, pasar lista, y consultar la ficha de cada clienta. Y que la clienta deje
de ver lo que no debe.

---

## 1. Calendario con tres vistas y pasar lista

Una única pantalla compartida por los dos roles: `/admin/clases` y
`/entrenador/clases` renderizan el mismo componente. Sustituye al
`CalendarioSemanal` actual, que agrupa por día de la semana y muestra todas las
sesiones existentes a la vez.

**Selector de vista** en la cabecera: Día · Semana · Mes. Abre siempre en **Día,
posicionado en hoy**. Flechas para moverse al anterior/siguiente dentro de la
vista activa. El estado vive en el cliente (`useState`), no en la URL: es una
pantalla operativa, no algo que se comparta por enlace.

### Vista de día

Las sesiones de la fecha seleccionada, ordenadas por hora. Cada una:

- Cabecera: hora de inicio y fin, entrenador, ocupación (`4/5`).
- Lista de personas. Las confirmadas primero, las de lista de espera después con
  su distintivo.
- Junto a cada **confirmada**, los controles de asistencia (ver §2) y, **solo
  para Elena**, el botón de quitarla de la clase (ver §3).
- Las de lista de espera no llevan controles de asistencia: no se puede asistir a
  algo que no está confirmado, y la función de asistencia ya lo rechaza.

Es la vista donde caben los nombres, así que es donde vive todo lo accionable.

### Vista de semana

Los siete días de la semana seleccionada. Cada sesión aparece como una fila
compacta: hora y número de apuntados. **Sin nombres** — no caben en móvil y
convertirían la vista en un muro. Es para ver la forma de la semana, no para
operar.

### Vista de mes

Rejilla del mes. Cada casilla muestra el **total de personas apuntadas ese día**
y un indicador visual de carga (vacío / flojo / lleno), calculado sobre la suma
de aforos de las sesiones del día. Sirve para detectar de un vistazo qué días
flojean.

Los días sin sesiones se ven apagados, sin número.

---

## 2. Asistencia reversible

### El problema actual

`marcar_asistencia(p_reserva_id uuid, p_asistio boolean)` solo va hacia adelante:
no hay forma de volver a `pendiente`. Y como `cancelar_reserva` rechaza cancelar
una reserva con la asistencia ya registrada, **un clic mal dado deja la reserva
atrapada de forma permanente** — ni la clienta ni Elena pueden deshacerlo desde
la app. Construir la pantalla encima de esto sería entregarle el fallo a Iván.

### El cambio

Migración `0012`, redefiniendo la función con la firma:

```
marcar_asistencia(p_reserva_id uuid, p_asistencia estado_asistencia_enum)
```

El parámetro booleano no puede expresar "pendiente"; el enum sí, y ya existe
(`pendiente` | `asistio` | `no_asistio`).

**Ajuste de deuda por transición.** Hoy solo suma. Pasa a calcular la diferencia
entre el estado anterior y el nuevo:

| De | A | Deuda |
|---|---|---|
| pendiente | asistio | — |
| pendiente | no_asistio | +1 |
| no_asistio | asistio | −1 |
| no_asistio | pendiente | −1 |
| asistio | no_asistio | +1 |
| asistio | pendiente | — |

Con suelo en cero (`greatest(0, ...)`) para que un desajuste no deje la deuda en
negativo.

**Guarda de fecha.** No se puede marcar asistencia de una clase que todavía no ha
empezado (`sesion.fecha + clase.hora_inicio > now()`). Marcar el futuro no tiene
sentido y era la vía por la que se atrapaban reservas.

**Se mantiene** el resto: solo `admin` y `entrenador` pueden llamarla, y solo
sobre reservas en estado `confirmada`.

### Quién puede

Elena e Iván, igual que hasta ahora. Elena no necesita permisos extra: con la
vuelta atrás ya tiene la última palabra — si Iván marca mal, ella desmarca y,
si hace falta, quita a la persona de la clase.

### Efecto en `cancelar_reserva`

La guarda "no se puede cancelar con la asistencia registrada" pasa a ser
inalcanzable por uso legítimo: la asistencia solo se puede marcar una vez la
clase ha empezado, y una sesión empezada tampoco se puede cancelar (guarda de
sesión pasada, que salta antes). Se **mantiene** como defensa en profundidad,
pero su test deja de poder montar el escenario a través de la RPC — pasará a
preparar el estado con el cliente admin para seguir verificando que la guarda
existe.

---

## 3. Quitar a una clienta de una clase

Botón visible **solo para Elena**, junto a cada reserva confirmada en la vista de
día. Llama a la acción `cancelarReserva` ya existente; la RPC ya autoriza a
`admin` a cancelar reservas ajenas.

**Confirmación en dos pasos, en línea** (sin diálogo nativo del navegador): el
primer clic cambia el botón a un estado de confirmación que dice qué va a pasar,
el segundo ejecuta. Cancelar la confirmación lo devuelve a su estado normal.

**Por qué la confirmación importa aquí.** Quitar a una clienta de bono a menos de
24h de la clase **le consume el crédito**, igual que si hubiera cancelado ella
tarde. Es la regla que decidiste, y aplicada a una acción de Elena resulta
injusta para la clienta. Hoy no hay forma de devolverle ese crédito desde la app
(está anotado en `docs/deuda-tecnica.md`). Así que el texto de confirmación dirá
explícitamente si esa cancelación va a costarle el crédito, para que Elena decida
con la información delante.

No se construye ningún mecanismo de compensación: eso requiere decidir con Elena
qué debería pasar, y va en la lista de preguntas pendientes.

---

## 4. Ficha de clienta

Página de detalle en `/admin/clientes/[id]` y `/entrenador/clientes/[id]`
(idéntica, pero sin acciones para Iván). Se llega pulsando el nombre en el
listado que ya existe.

Contenido:

- **Datos y plan**: nombre, contacto, estado de alta/baja, plan contratado, días
  por semana habituales, y las notas de rutina.
- **Créditos**: para clientas de bono, cuántos le quedan de cada bono activo y
  cuándo caduca cada uno, distinguiendo los normales de los de recuperación. Y su
  deuda pendiente si tiene.
- **Historial de pagos**: lo que ya se registra en `pagos`.
- **Historial de asistencia**: el contenido de `reservas_historial`, que llevamos
  guardando desde el principio y no se ve en ninguna parte — cuándo se apuntó,
  cuándo se desapuntó, cuándo entró desde lista de espera, y si vino o faltó.
  Ordenado de más reciente a más antiguo, con la fecha y hora de la clase a la
  que se refiere cada movimiento.

Es lo que la propuesta comercial le vendió literalmente como "ficha con plan,
notas de rutina, historial de pagos y asistencia".

---

## 5. Retoques en la vista de la clienta

- **Libre / Completo en lugar del número.** Elena pidió que la clienta no vea
  cuántas plazas quedan, para que no elija las clases con menos gente. Hoy se le
  muestra "3 plazas libres de 5". El cálculo pasa al servidor y al navegador solo
  viaja un booleano.

  *Limitación honesta:* el dato sigue siendo consultable llamando a la API de
  Supabase directamente, porque las policies dejan leer `aforo_max`,
  `aforo_efectivo` y los conteos de ocupación. Blindarlo requiere una RPC que
  devuelva solo libre/completo o permisos por columna, y está en la lista de
  preguntas para Elena (cuánto le importa). Esto es una mejora real —
  el número deja de estar en la página— pero no un blindaje.

- **Recortar a la ventana de tres semanas.** El listado enseña sesiones más allá
  del límite que la RPC acepta, así que hay tarjetas con botón de reservar que
  fallan al pulsarlas.

- **Arreglar el desfase de fecha.** `hoy` se calcula con `new Date()` dentro de un
  componente cliente, así que entre las 00:00 y las 02:00 hora local el servidor
  (UTC) y el navegador discrepan y la lista renderizada no coincide. Pasa a
  calcularse en el servidor y llegar como propiedad.

---

## Estructura de archivos

Se parte el calendario en piezas pequeñas en vez de un componente único: cada
vista tiene su propia lógica de disposición y agrupación, y juntas darían un
archivo difícil de manejar.

```
supabase/migrations/
  0012_marcar_asistencia_reversible.sql   (nuevo)

lib/
  database.types.ts                       (regenerado)
  actions/asistencia.ts                   (firma nueva)
  supabase/queries.ts                     (+ obtenerHistorialDeCliente)

components/calendario/
  calendario-clases.tsx                   (nuevo — estado de vista y fecha)
  selector-vista.tsx                      (nuevo — Día/Semana/Mes + navegación)
  vista-dia.tsx                           (nuevo — nombres, asistencia, quitar)
  vista-semana.tsx                        (nuevo — compacta, solo conteos)
  vista-mes.tsx                           (nuevo — rejilla con carga)
components/
  calendario-semanal.tsx                  (se elimina, lo reemplaza lo anterior)
  ficha-cliente.tsx                       (nuevo)
  horario-cliente.tsx                     (libre/completo, ventana, fecha)

app/
  admin/clases/page.tsx                   (usa el calendario nuevo)
  entrenador/clases/page.tsx              (idem, sin el botón de quitar)
  admin/clientes/[id]/page.tsx            (nuevo)
  entrenador/clientes/[id]/page.tsx       (nuevo)
  cliente/page.tsx                        (calcula libre/completo en servidor)

tests/integration/
  rpc-asistencia.test.ts                  (firma nueva + reversibilidad + guarda)
  rpc-cancelacion.test.ts                 (el test de asistencia-bloquea-cancelar
                                           prepara el estado con el cliente admin)
```

## Pruebas

La lógica nueva vive en la migración 0012, así que ahí es donde va la cobertura
real, siguiendo el patrón ya establecido (tests de integración contra el proyecto
Supabase real, sin mocks):

- Marcar `asistio` y volver a `pendiente`: la reserva queda como estaba.
- Marcar `no_asistio` suma una falta; desmarcarla la quita.
- Pasar de `no_asistio` a `asistio` quita la falta (no la duplica).
- No se puede marcar una clase que aún no ha empezado.
- Sigue rechazando a las clientas y a las reservas no confirmadas.

Las pantallas no llevan tests automáticos: el proyecto no tiene infraestructura
de tests de componentes y montarla no entra en este trabajo. Se verifican
manualmente con las cuentas demo.

## Fuera de alcance

- Crear, editar o borrar clases y sesiones.
- El botón de copiar semana.
- Registrar bonos y ajustar el aforo de una sesión concreta.
- Compensar un crédito perdido por una cancelación del centro.
- Blindar el aforo a nivel de API.
- Stripe, emails, PWA y la landing.
