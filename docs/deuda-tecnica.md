# Deuda técnica y decisiones pendientes

Puntos abiertos que salieron de las revisiones de código de la capa de datos
(rama `worktree-reglas-negocio-v1`, fusionada el 2026-08-08). Ninguno bloquea lo
que ya está construido; se anotan aquí para no redescubrirlos más adelante.

## 2026-08-20 — proxy.ts redirigía las peticiones de Stripe a /login [RESUELTO]

`proxy.ts` protegía **todas** las rutas (matcher `/((?!_next/static|...).*)`,
sin excluir `/api`), así que una petición de Stripe al webhook (sin cookie de
sesión) se topaba con el middleware, no encontraba usuario, y la
redirigía (307) a `/login` antes de llegar al route handler. El webhook
nunca se ejecutaba y ningún pago se marcaba como cobrado, sin ningún error
visible salvo el log `[307]` en `stripe listen`. Arreglado excluyendo `api`
del matcher — las rutas de API gestionan su propia autenticación (aquí, la
firma de Stripe). Si se añaden más rutas bajo `/api/` en el futuro, revisar
si necesitan su propia comprobación de auth, porque ya no pasan por
`proxy.ts`.

## 2026-08-20 — app.elefitness.es no serví­a nada [RESUELTO]

El dominio se había añadido al proyecto de Vercel con `vercel domains add`
pero nunca quedó asociado a un deployment (`DEPLOYMENT_NOT_FOUND`), y por
separado el proyecto tenía activada la protección SSO de Vercel incluso para
dominios propios. Arreglado con `vercel alias set <deployment> app.elefitness.es`
más `vercel project protection disable elefitness --sso`. Nota para la
próxima vez que se cree un proyecto de Vercel para este repo: comprobar
ambas cosas (alias real a un deployment, SSO desactivada) antes de dar por
bueno un dominio solo porque `vercel domains add` no dio error.

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

- ~~**`marcar_asistencia` no tiene vuelta atrás ni comprobación de fecha.**~~
  **RESUELTO.** La migración 0012 la hizo reversible (toggle libre entre
  asistió/no asistió/pendiente, ajustando `deuda_creditos` por el delta real
  en vez de sumar sin más) y la 0020 quitó la guarda de fecha a petición de
  Elena (2026-08-17): ahora se puede marcar en cualquier momento, incluso
  antes de que empiece la clase.

- **Un crédito perdido tiene remedio manual, pero no automático.** Desde la
  migración 0010 `creditos_usados` solo sube por sí solo. Si Elena cancela
  una sesión entera, las clientas de bono pierden el crédito. Ya existe
  pantalla para compensarlo a mano (`devolverCreditoSesion` /
  `anadirSesionExtraBono` en la ficha de clienta, sección "Sesiones de bono
  consumidas"), pero sigue siendo un gesto manual por clienta, uno a uno —
  no hay un "deshacer en bloque" si cancela una clase con varias apuntadas.

- **Superar el tope mensual es silencioso y ahora cuesta dinero.** Una clienta que
  cancela con +24h estando por encima del tope pierde el crédito y no recibe ni
  compensación ni aviso: la RPC no lo señala y `traducirError` no tiene caso para
  ello.

- **Mismo patrón de fecha estática en tiempo de render, ahora en
  `reserva-cliente.tsx`.** El fichero original (`horario-cliente.tsx`) se
  eliminó en el rediseño visual del 14-08 y su sucesor repite `const ahora =
  new Date()` dentro de un componente cliente que Next renderiza también en
  servidor (línea 58). El riesgo práctico es bajo (ventana de menos de un
  segundo, no las ~2h del patrón original), pero conviene resolverlo con el
  mismo criterio que ya se aplicó al calendario: pasar `ahora`/`hoy` como
  prop calculada en servidor en vez de recalcularla en el cliente.

## 2026-08-11 — Riesgo de truncado silencioso en obtenerSesiones/obtenerReservas [RESUELTO 2026-08-17]

`obtenerSesiones`/`obtenerReservas` aceptan ahora un `{ desde?, hasta? }` que
acota por `sesiones.fecha` (para `obtenerReservas`, via join
`sesiones!inner(fecha)` -- `reservas` no tiene columna de fecha propia).
Cada llamante pasa la ventana que de verdad necesita: `app/cliente/page.tsx`
la ventana de reserva de 3 semanas, `app/admin|entrenador/clases/page.tsx`
una ventana movil de -3/+6 meses (generosa para navegar el calendario sin
volver a acumular sin limite), los dos dashboards solo hoy o las proximas
dos semanas. Las paginas de ficha de clienta siguen sin acotar (resuelven el
historial de una sola clienta, no el volumen del centro entero -- no es el
mismo riesgo, pero si crece podria convenir acotarlo tambien mas adelante).

`lib/supabase/queries.ts`: `obtenerSesiones()` y `obtenerReservas()` hacen
`select` sin `.range()`/`.limit()`, y ahora alimentan el calendario completo
(dia/semana/mes). PostgREST tiene un ajuste de proyecto, **Max Rows**
(Dashboard → Settings → API), que trunca cualquier `select` sin rango
explicito por encima de ese numero -- en silencio, sin error ni cabecera que
lo distinga de "no hay mas filas". El valor por defecto que documenta
Supabase para proyectos nuevos es 1000, pero es una opcion de panel, no algo
que quede en `supabase/config.toml` (este repo no tiene ese fichero: el
proyecto se administra desde el Dashboard hosted) ni algo consultable con la
service_role key vía SQL o REST. No tengo acceso a un token de Management API
en este entorno, asi que **no he podido confirmar el valor real configurado**
-- esto queda pendiente de mirar en el Dashboard, no asumido.

Estado actual del proyecto (consultado en vivo con la service_role key el
2026-08-11): 8 filas en `reservas`, 2 en `sesiones` -- es solo el seed, muy
lejos de cualquier limite razonable. No hay riesgo hoy.

Proyeccion con el ritmo de uso real descrito en el brief (~3 clases/dia x 4-5
clientas): 12-15 reservas/dia ⇒ el limite de 1000 filas (si es ese el valor
configurado) se cruzaria en unos 65-85 dias de uso real, es decir dentro de
2-3 meses de que el centro empiece a operar. A partir de ahi la vista de dia
empezaria a mostrar menos nombres de los que realmente hay reservados, sin
ningun aviso.

No lo he arreglado: la solucion correcta es acotar ambas consultas por rango
de fechas (recibir `desde`/`hasta` en vez de traer toda la tabla), y eso toca
a todos los llamantes de `obtenerSesiones`/`obtenerReservas`
(`app/cliente/page.tsx`, `app/admin/clases/page.tsx`,
`app/entrenador/clases/page.tsx`, y quien mas las use) -- es una tarea propia,
no un ajuste de una linea. Recomendacion: hacerlo antes de que el centro
lleve ~1-2 meses de operacion real, o como mitigacion mas barata a corto
plazo, confirmar y si hace falta subir el Max Rows del Dashboard mientras se
programa el cambio de verdad.

## Limpieza y robustez

- `ajustarAforoSesion` existe como server action pero no la llama nadie: el
  plan de UI debe conectarla. (`crearBono` ya está conectada, en
  `AsignarBonoDialogo`.)
- La rama `dias_semana_habituales < 3` (tope de 1 recuperación al mes) no está
  cubierta por tests: Laura es la única clienta de bono en los datos semilla.
  Tampoco hay tests de integración para `mover_horario_cliente` (migración
  0022, cambio de horario fijo sin penalizar).
- ~~`copiar_semana` ignora `clases.recurrente`~~ **Ya no aplica**: quedó
  decidido y en uso — `copiar_semana` solo copia sesiones de clases con
  `recurrente = true`, y desde la migración 0022 también reserva sola a las
  mensuales con `clase_habitual_id` en esas clases.
- `cancelar_reserva` lee la reserva sin `for update`. Dos cancelaciones
  simultáneas de la misma reserva podrían pasar ambas la comprobación y ejecutar
  la promoción de lista de espera dos veces. Es un patrón heredado, pero ahora el
  bloque también emite un bono.
- ~~El corte de las 24h compara un `timestamp` sin zona contra `now()`,
  apoyándose en que la zona de la sesión de Postgres coincida con la del
  negocio.~~ Resuelto por la migración 0014 (rama `worktree-panel-mandos-v1`):
  `v_fecha_hora_sesion` ahora se calcula con `at time zone 'Europe/Madrid'`
  explícito, tanto para este corte de 24h como para las guardas de "ya ha
  pasado" / "todavía no ha empezado" de `marcar_asistencia`, `reservar_sesion`
  y `cancelar_reserva`.
- Faltan índices en las claves foráneas de `bonos_cliente` y `reservas_historial`.
- `vitest.config.ts` usa `isolate: false` para que `signInAs` cachee sesiones y no
  agotar el límite de inicios de sesión de Supabase. Funciona, pero es una palanca
  más amplia de lo necesario: un `globalSetup` que reparta los tokens sería más
  ajustado.

## Salido de la revisión final del panel de mandos (2026-08-11)

- ~~**`proximoCobro` se calcula desde hoy, no desde el cobro anterior.**~~
  **RESUELTO 2026-08-17.** `components/tabla-cobros.tsx` ahora suma el mes al
  `proximo_cobro` que ya tenía la clienta (`sumarMesesMismoDia(pago.proximoCobro
  ?? fechaHoy, 1)`), y solo se ancla a hoy si todavía no tenía ningún ciclo.
  El webhook de Stripe (`app/api/webhooks/stripe/route.ts`) hereda la fecha
  real de `current_period_end` de la suscripción, no este cálculo — no había
  nada que arrastrar.

- **Ninguna cobertura de la rama `dias_semana_habituales < 3` ni del bono de
  recuperación para clientas mensuales** más allá de lo ya anotado arriba: los
  datos semilla solo tienen una clienta de bono.

- **La entrada de arriba sobre el desajuste de hidratación de
  `horario-cliente.tsx` dice "resuelto" y es un poco generosa.** Queda un
  `new Date()` en tiempo de render dentro de un componente cliente que Next
  también renderiza en servidor. La ventana pasó de ~2h al día a menos de un
  segundo por sesión, así que en la práctica está resuelto — pero es el mismo
  patrón de `ahora` como valor estático que ya está anotado para el calendario, y
  se debería cerrar junto con él.

- **`tests/integration/rpc-reservas.test.ts` tuvo un fallo puntual sin explicar**
  (una promoción de lista de espera que no ocurrió) que dos ejecuciones
  posteriores no reprodujeron. La explicación inicial (estado residual del seed)
  quedó descartada al comprobar que ese estado habría hecho fallar antes otro
  test del mismo fichero. El fichero se ha hecho autocontenido, lo que elimina la
  causa más probable, pero la raíz sigue sin identificarse. Si reaparece, volcar
  el estado de la sesión en el fallo antes de sacar conclusiones.
