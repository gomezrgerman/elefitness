# Deuda técnica y decisiones pendientes

Puntos abiertos que salieron de las revisiones de código de la capa de datos
(rama `worktree-reglas-negocio-v1`, fusionada el 2026-08-08). Ninguno bloquea lo
que ya está construido; se anotan aquí para no redescubrirlos más adelante.

## Pendientes de decisión con Elena

- **Bonos de recuperación que se reciclan.** Un bono de recuperación caduca en 14
  días, así que al reservar se gasta antes que el bono normal (el orden es por
  fecha de caducidad). Consecuencia: una clienta puede reservar con un bono de
  recuperación, cancelar con +24h, y ganar otro. El tope mensual lo acota, pero
  significa "2 bonos emitidos al mes", no "2 cancelaciones compensadas al mes".
  Económicamente es neutro o favorable para el centro; conviene confirmarlo.

- **Aforo oculto: hoy solo es cosmético.** La regla es que la clienta nunca vea
  el número de plazas, solo Libre/Completo. Pero las policies de RLS le dejan
  leer `sesiones.aforo_efectivo`, `clases.aforo_max` y los conteos exactos de
  `ocupacion_sesiones` directamente desde la API. Ocultarlo solo en la pantalla
  no basta: cualquiera que abra las herramientas del navegador ve los números.
  Si la regla importa de verdad, hace falta una RPC que devuelva `libre boolean`
  o permisos a nivel de columna. Decisión previa al plan de UI.

## Errores latentes (ninguno alcanzable desde la UI actual)

- **`marcar_asistencia` no tiene vuelta atrás ni comprobación de fecha.** Si Iván
  marca por error una sesión futura, la reserva queda atrapada: las guardas de
  cancelación rechazan cancelar una reserva con la asistencia ya registrada, y
  esa guarda aplica también a Elena. La única salida hoy es tocar la base de
  datos a mano. Es el candidato más claro al próximo arreglo.

- **Un crédito perdido no tiene remedio dentro de la app.** Desde la migración
  0010 `creditos_usados` solo sube. Si algún día Elena cancela una sesión entera,
  las clientas de bono pierden el crédito y el único instrumento de compensación
  es `crear_bono`, que todavía no tiene pantalla.

- **Superar el tope mensual es silencioso y ahora cuesta dinero.** Una clienta que
  cancela con +24h estando por encima del tope pierde el crédito y no recibe ni
  compensación ni aviso: la RPC no lo señala y `traducirError` no tiene caso para
  ello.

- **Posible desajuste de hidratación en `horario-cliente.tsx`.** Calcula `hoy` con
  `new Date().toISOString()` dentro de un componente cliente, así que entre las
  00:00 y las 02:00 hora local el servidor (UTC) y el navegador no coinciden y la
  lista de tarjetas difiere. Además la lista no se recorta a la ventana de 3
  semanas, de modo que se ven tarjetas que la RPC va a rechazar.

## Limpieza y robustez

- `ajustarAforoSesion` y `crearBono` existen como server actions pero no las llama
  nadie: el plan de UI debe conectarlas.
- La rama `dias_semana_habituales < 3` (tope de 1 recuperación al mes) no está
  cubierta por tests: Laura es la única clienta de bono en los datos semilla.
- `copiar_semana` ignora `clases.recurrente` — nunca se decidió para qué sirve ese
  campo.
- `cancelar_reserva` lee la reserva sin `for update`. Dos cancelaciones
  simultáneas de la misma reserva podrían pasar ambas la comprobación y ejecutar
  la promoción de lista de espera dos veces. Es un patrón heredado, pero ahora el
  bloque también emite un bono.
- El corte de las 24h compara un `timestamp` sin zona contra `now()`, apoyándose
  en que la zona de la sesión de Postgres coincida con la del negocio. Conviene
  fijar la zona explícitamente.
- Faltan índices en las claves foráneas de `bonos_cliente` y `reservas_historial`.
- `vitest.config.ts` usa `isolate: false` para que `signInAs` cachee sesiones y no
  agotar el límite de inicios de sesión de Supabase. Funciona, pero es una palanca
  más amplia de lo necesario: un `globalSetup` que reparta los tokens sería más
  ajustado.
