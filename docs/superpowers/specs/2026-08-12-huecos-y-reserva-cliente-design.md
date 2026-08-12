# Rejilla de huecos y nueva reserva de la clienta — diseño

**Fecha:** 2026-08-12

**Contexto:** Elena confirmó cómo funciona su horario de verdad. El centro tiene
una rejilla de franjas horarias; 51 celdas de esa rejilla son **clases fijas** y
el resto son **huecos**. La clienta solo puede apuntarse a las clases fijas. Los
huecos son de Elena: puede meter a alguien a mano sin abrirlos a nadie más, o
abrirlos para que cualquiera se apunte.

El modelo actual no tiene ni la noción de hueco ni la de sesión cerrada, así que
ninguna de las dos cosas se puede hacer hoy. Este diseño las añade, y de paso
rehace la pantalla de reserva de la clienta, que con el horario real pinta unas
150 tarjetas de golpe.

---

## 1. La rejilla de franjas

Las franjas no se pueden deducir de las clases existentes: las tres de mediodía
(11:10, 12:00, 13:00) no tienen ninguna clase, y son precisamente las que Elena
querría abrir. Hace falta guardarlas.

**Tabla nueva `franjas_horarias`** — `(id, hora_inicio, hora_fin, orden)`. Quince
filas, las del horario del centro. `orden` evita depender de ordenar por texto y
permite reordenar sin tocar las horas.

La rejilla que ve Elena es el producto de las 15 franjas por los días de lunes a
sábado. Cada celda está en uno de tres estados:

- **Clase fija** — hay una `clase` recurrente para ese día y esa franja.
- **Hueco** — no hay clase. Elena puede abrirlo.
- **Abierto puntualmente** — hay una clase no recurrente, creada para una fecha
  concreta.

Solo `admin` y `entrenador` pueden leer `franjas_horarias`; a la clienta no le
hace falta y no tiene por qué saber qué huecos existen.

## 2. Abrir un hueco

Se apoya en `clases.recurrente`, un campo que existe desde el principio y al que
nunca se le dio significado. A partir de ahora:

- **`recurrente = true`** — parte del horario fijo. Se repite todas las semanas.
- **`recurrente = false`** — clase suelta, creada para una fecha concreta.

Así, abrir un hueco son dos operaciones distintas, y la pantalla debe dejar claro
cuál se está haciendo porque una cambia el horario para siempre:

- **Solo ese día** → se crea una `clase` con `recurrente = false` y su `sesion`
  para esa fecha. La semana siguiente el hueco vuelve a estar vacío.
- **A partir de ahora** → se crea una `clase` con `recurrente = true`. Las
  semanas futuras la heredan al copiar el horario.

Aforo por defecto **5**, editable al abrir. Entrenador: se elige al abrir; por
defecto, el de la franja contigua si lo hay, si no Elena.

`copiar_semana` ya copia sesiones de la semana origen sin mirar `recurrente`
(está anotado en la deuda técnica). Con este diseño ese detalle pasa a importar:
**una clase no recurrente no debe propagarse** al copiar, o un hueco abierto un
día suelto acabaría repitiéndose para siempre. Hay que filtrar por `recurrente`.

## 3. Sesión abierta o cerrada

**Campo nuevo `sesiones.abierta boolean not null default true`.**

- `true` — la clienta puede reservar, si la sesión está dentro de su ventana.
- `false` — solo Elena puede meter gente. La sesión no aparece en el listado de
  reserva de nadie.

`reservar_sesion` rechaza una sesión cerrada salvo que quien llame sea `admin`.
Es la misma forma que ya tienen las demás guardas de esa función.

Esto cubre también el caso inverso —cerrar una clase fija concreta— que es la
funcionalidad de "bloquear clases" que la propuesta comercial dejó en Fase 2.
Conviene decírselo a Elena: no es un extra, es como trabaja.

**Qué ve la clienta a la que Elena apuntó a mano:** su reserva aparece con
normalidad en sus próximas clases y puede cancelarla. Lo que no aparece es la
hora en el listado para reservar — ni a ella ni a nadie. Es coherente: tiene
plaza porque Elena se la dio, no porque la hora esté abierta.

Consecuencia a tener en cuenta: si cancela, pierde la plaza y **no puede volver a
cogerla** ella sola. La cancelación con más de 24h le genera su bono de
recuperación como siempre, así que no pierde el crédito, pero tendrá que volver a
hablar con Elena. Es correcto, pero merece un aviso en la pantalla de cancelar.

## 4. La pantalla de reserva de la clienta

Hoy lista todos los días y todas las horas como tarjetas: con el horario real son
unas 150. Inservible en móvil.

**Tira de días arriba, horas del día elegido debajo.** Es el patrón de las apps de
reserva que funcionan en móvil, y encaja con cómo piensa la clienta: primero
decide el día, luego mira qué horas le cuadran.

- **Tira de días**: deslizable horizontalmente, desde hoy hasta el final de la
  ventana de tres semanas. Cada día muestra su abreviatura y el número. Los días
  sin ninguna clase con hueco se ven apagados; los que tienen la reserva de la
  clienta llevan una marca. Arranca en el primer día con hueco.
- **Horas del día**: las clases de ese día como una lista vertical, con hora,
  entrenador y **Libre / Completo** — nunca cifras, la propiedad que Elena pidió
  y que ya está resuelta en el servidor.
- Si la clienta ya tiene reserva en ese día, se ve arriba con su botón de
  cancelar.

Se descarta el desplegable de día y hora: esconde la disponibilidad, obliga a
mirar día por día a ciegas, y en un centro donde las clases se llenan eso es
justo lo que hay que ver de un vistazo. Se descarta también el calendario de mes
completo: demasiado peso visual para una ventana de tres semanas, y casi todo el
mundo reserva para los próximos días.

La ventana de tres semanas, el descarte de las clases ya empezadas y el cálculo
de fechas en hora española se mantienen intactos.

---

## Alcance

**Dentro:**

- Tabla `franjas_horarias` con sus políticas, y las 15 franjas cargadas.
- `sesiones.abierta`, con la guarda en `reservar_sesion`.
- Significado de `clases.recurrente`, y `copiar_semana` filtrando por él.
- Rejilla de huecos en el panel de Elena, con abrir hueco (puntual o fijo).
- Cerrar y reabrir una sesión existente.
- Rediseño de la pantalla de reserva de la clienta.
- Aviso al cancelar una reserva de una hora cerrada.

**Fuera, a propósito:**

- Editar o borrar clases del horario fijo (distinto de abrir huecos; merece su
  propia conversación con Elena sobre qué pasa con las reservas existentes).
- El botón de copiar semana en la interfaz — la función existe y se corrige aquí,
  pero su pantalla va aparte.
- Registrar bonos, ajustar aforo de una sesión suelta, etiquetas de clienta,
  referidos, Stripe, emails, PWA y la landing.

## Riesgos

- **`copiar_semana` propagando clases sueltas.** Si se olvida el filtro por
  `recurrente`, un hueco abierto un martes concreto se repite indefinidamente.
  Merece test.
- **Fuga del aforo.** La pantalla nueva de la clienta vuelve a tocar el punto
  donde el número de plazas podría escaparse al navegador. El servidor debe
  seguir resolviendo Libre/Completo, y la tira de días no puede exponer cuántos
  huecos quedan por día — solo si hay alguno.
- **Volumen de consultas.** `obtenerSesiones` y `obtenerReservas` ya traen la
  tabla entera y con 204 sesiones sembradas están más cerca del límite de
  truncado silencioso anotado en la deuda técnica. Este trabajo no lo agrava,
  pero conviene no empeorarlo.
