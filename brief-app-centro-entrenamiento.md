# App Centro de Entrenamiento — Brief del MVP

**Producto:** app a medida (tipo G2Fit) para un centro de entrenamiento grupal — reservas de clase, pagos recurrentes y gestión de clientes.
**Referencia:** Harbiz (competidor todo-en-uno) — la clienta solo usa el bloque de Management + Payments, no coaching/IA/marketing.
**Objetivo:** quitarle a la dueña el trabajo manual de apuntar gente a clase y cobrar cuotas, con una web app (PWA) construible con el mismo stack que G2Fit y NutriFlow.

---

## 1. Modelo del negocio (confirmado con Germán)

- Entrenamientos **grupales** con horario fijo y aforo limitado por clase.
- Dentro de cada clase, **cada cliente tiene su propio programa/rutina** asignado por la entrenadora — no es una clase genérica, es seguimiento individual dentro de un grupo.
- Formato de la app: **PWA** (web instalable, sin App Store/Google Play). Evita cuentas de desarrollador, revisión de Apple y doble mantenimiento.
- Pasarela de pago: sin preferencia cerrada por parte de Germán → **se recomienda Stripe** por integración simple con Next.js/Supabase y soporte nativo de cobros recurrentes (Redsys queda como alternativa si el banco de la clienta lo exige).

## 2. Alcance del MVP

### Dentro (v1)

- **Auth y roles**: login para la dueña (admin) y para cada clienta (usuario). Supabase Auth + RLS.
- **Gestión de clientes**: ficha con datos de contacto, estado de alta/baja, bono/plan contratado, y un campo de **rutina/notas asignadas** (texto libre o estructura simple — no motor de rutinas complejo).
- **Calendario de clases**: la dueña crea clases (día, hora, aforo máximo, monitor). Las clientas ven el horario y reservan plaza.
- **Reservas con control de aforo**: al llenarse el aforo, la clase se cierra o pasa a lista de espera. Cancelación con límite de horas antes de la clase (regla configurable).
- **Pagos recurrentes**: cuota mensual o bono de clases vía Stripe Checkout + suscripciones. Webhooks para marcar altas/bajas automáticamente por impago.
- **Panel de la dueña**: ver clases del día, quién ha reservado, estado de cobros, alta/baja de clientas.
- **Notificaciones básicas**: email de confirmación de reserva y aviso de cobro (Resend), sin chat ni push todavía.

### Fuera (v2+, no construir ahora)

- Creador de rutinas con IA, planificación nutricional, biblioteca de contenido (bloque Coaching de Harbiz).
- Chat cliente-entrenadora, comunidad, desafíos/logros, sistema de referidos (bloque Marketing).
- Apps nativas en tiendas.
- Dashboard avanzado de informes financieros (de momento basta con ver cobros en Stripe).
- Multi-centro / multi-tenant — esto es una app **para un solo negocio**, no un SaaS que vendas a varios gimnasios (a diferencia de NutriFlow).

## 3. Arquitectura

Mismo stack que G2Fit y NutriFlow — cero curva de aprendizaje:

- **Frontend/backend:** Next.js 15 (App Router, server actions), Tailwind, shadcn/ui.
- **BD/Auth:** Supabase (Postgres + Auth + RLS por rol admin/cliente).
- **Pagos:** Stripe Checkout + Billing Portal + webhooks.
- **Email:** Resend (confirmaciones de reserva, avisos de cobro).
- **Deploy:** Vercel + Supabase cloud.
- **PWA:** manifest + service worker (instalar en pantalla de inicio del móvil).

### Modelo de datos (núcleo)

```
centro           (id, nombre, logo_url, color_marca, stripe_account_id)
users            (id, email, rol[admin|cliente], nombre, telefono)
clientes         (id, user_id, estado[activo|baja], plan_id, notas_rutina, created_at)
planes           (id, nombre, precio, tipo[mensual|bono], clases_incluidas, stripe_price_id)
clases           (id, dia, hora_inicio, hora_fin, aforo_max, monitor, recurrente boolean)
reservas         (id, clase_id, cliente_id, estado[confirmada|lista_espera|cancelada], created_at)
pagos            (id, cliente_id, stripe_subscription_id, estado, ultimo_cobro, proximo_cobro)
```

## 4. Roles y flujos

**Dueña (admin):**
1. Crea/edita clases y horarios.
2. Da de alta clientas, les asigna plan y notas de rutina.
3. Ve cada día quién ha reservado y el aforo restante.
4. Consulta estado de cobros (al día / impago).

**Clienta:**
1. Se registra o recibe invitación.
2. Ve el horario semanal y reserva plaza en la clase que quiera (según aforo).
3. Cancela con margen de horas si no puede ir.
4. Gestiona su suscripción/pago desde el portal de Stripe.

## 5. Roadmap (sprints orientativos)

| Sprint | Entregable |
|---|---|
| 1 | Setup repo, Supabase (schema + RLS), auth con 2 roles, alta de clientes |
| 2 | Calendario de clases + reservas con control de aforo y lista de espera |
| 3 | Stripe (planes, checkout, webhooks de alta/baja por cobro) |
| 4 | Panel de la dueña, notificaciones por email, PWA (manifest + instalación), deploy |

**Criterio de "MVP terminado":** la dueña crea el horario de la semana, una clienta se registra, reserva una clase con aforo limitado, paga su cuota, y la dueña ve todo desde su panel sin tocar tú nada.

## 6. Presupuesto y modelo de cobro a la clienta

Esto es un proyecto a medida para un solo negocio (como G2Fit), no un SaaS multi-cliente — el cobro es a la dueña del centro, no a sus clientas.

Puntos a fijar con ella antes de presupuestar:

- **Desarrollo:** tarifa cerrada por el MVP (referencia: lo que cobraste por G2Fit) o por horas/sprint.
- **Mantenimiento mensual:** hosting (Vercel + Supabase suelen entrar en tier gratuito con poco volumen), dominio, y una cuota de soporte/mantenimiento si quieres recurrencia además del proyecto puntual.
- **Comisión de Stripe:** la asume el centro (o se repercute al precio de la cuota), no tú.

## 7. Reunión con la clienta (2026-08-05) — decisiones confirmadas

Nombre real del negocio: **Elefitness** (coincide con el nombre del proyecto/repo). Grabación: Fathom, transcrita y resumida más abajo.

Grabación completa: https://fathom.video/share/Ldzy8nqYrXjJQCA5mQxMMZknvnrtc9Hm

### Por qué deja Harbiz

- No permite copiar horarios semanales → recreación manual cada semana.
- No aplica la política de cancelación con 24h de antelación → clientas recuperan sesiones que no deberían, pérdida de ingresos.
- Calendario no muestra nombres de clientes.
- La lista de "clientes cancelados" se llena de histórico irrelevante, los datos de clases en vivo no son fiables.
- Cero personalización para las reglas propias del negocio.

### Reglas de negocio nuevas (no estaban en el modelo original)

- **Copiar horario semanal**: plantilla de clases duplicable de una semana a otra, con alta/baja flexible de clientes por clase.
- **Cancelación con 24h de antelación** → genera un **bono de recuperación** (crédito distinto del bono normal):
  - Caduca a las **2 semanas** de emitido (evita acumulación a largo plazo).
  - Tope mensual: **1/mes** si la clienta entrena 1-2 días/semana, **2/mes** si entrena 3+ días/semana.
  - **Corregido el 2026-08-14 (ver punto 9): esto solo aplica a clientas de mensualidad.** Las de bono no reciben bono de recuperación — se les devuelve directamente el crédito consumido.
- **Asistencia real** (check-in en clase) como estado separado de "reserva confirmada" — las reglas de bono/deuda se disparan al marcar asistencia, no al reservar.
- **Sistema de deuda**: sesión perdida sin cancelar a tiempo se descuenta automáticamente del próximo bono que compre la clienta.
- **Aforo oculto al cliente**: solo ve "Libre" / "Completo", nunca el nº exacto de plazas (para que no elijan clases con pocos alumnos). Elena puede fijar además un **límite efectivo por debajo del aforo_max real** para un día concreto (ej. bajar plazas sin que el cliente vea que existe ese límite) — para él sigue siendo solo Libre/Completo.
- **Lista de espera** si el grupo/clase está lleno (ya estaba en el modelo original, reafirmado en la reunión).
- **Calendario con 3 vistas** (día / semana / mes) para los entrenadores (Elena e Iván); las clientas solo ven una **ventana de 3 semanas vista** hacia adelante para reservar.
- **Caducidad del bono de horario rotativo**: 3 meses desde la compra (distinto de la caducidad de 2 semanas del bono de recuperación — son dos tipos de crédito con reglas propias).
- **Historial por clase/grupo**: quién se ha apuntado, desapuntado y quién ha fallado (no ha marcado asistencia), visible desde la ficha de la clase — no solo el estado actual, el histórico de movimientos.
- **Personalización de marca**: logo y colores de Elefitness en la app.
- **Iván marca asistencia desde su panel** (confirmado en la propuesta comercial del 2026-08-05: "Panel de Iván: lectura + marcar asistencia") — no es de solo lectura al 100%, esta es la única excepción de escritura.

### Pendiente de aclarar con Elena antes de meterlo en el prototipo

- ~~**"Panel de notificaciones"**~~ **Resuelto (2026-08-16):** primero solo interno, para Elena e Iván (alertas de lista de espera movida, cancelaciones, pagos fallidos). Se decide más adelante si se extiende a avisos de cara a la clienta — eso sí se solaparía con lo diferido a v2.
- **Enlaces de atribución por entrenador** ("saber por parte de cada entrenador entra más gente, crear diferentes links para apuntarse"): esto es distinto del programa de referidos de clientes (que sí queda diferido). Suena a algo simple — un link distinto por entrenador que etiqueta de dónde vino el alta — pensado más para la landing page (Fase 2) que para el prototipo de gestión. Confirmarlo cuando se hable de la landing. **Sigue sin cerrar.**

### Pagos y Verifactu

- Stripe se conecta a la **cuenta Stripe ya existente** de Elefitness (no una nueva) — pagos, no cuota nueva.
- Objetivo inmediato: **exportar CSV** de pagos desde `pagos`, no depender de Harbiz para eso.
- **Verifactu se deja aparcado por ahora** — German decide seguir adelante sin bloquear el proyecto por esto. La prioridad es sacarla de Harbiz cuanto antes; la decisión de Stripe Billing vs facturación externa se retoma más adelante si hace falta, no es bloqueante para el prototipo ni para el desarrollo del MVP. `pagos` se mantiene exportable en formato limpio por si acaso, pero no se construye ningún motor de facturación certificado (ver también nota de Verifactu en memoria).

### Diferido a Fase 2 (fijado en la propuesta comercial del 2026-08-05, 2.000€ + IVA la Fase 1)

Ya estaban fuera de alcance en la sección "Fuera de alcance" original y se confirma que siguen fuera de la Fase 1 — dos de ellos (etiquetas y bloqueo) habían salido en la reunión como reglas nuevas, pero la propuesta comercial los formalizó como Fase 2, no Fase 1, así que **no se construyen todavía**:

- **Etiquetas de cliente** (many-to-many) para restringir acceso a clases concretas — ej. "Cliente de Iván", "Solo por la mañana".
- **Bloqueo manual de clases o grupos completos**, para reservar hueco sin abrirlo a todos (incluye días festivos).
- Programa de referidos con QR único y descuento automático.
- Recompensas/fidelización por asistencia continuada.
- Notificaciones personalizadas dentro de la app (ej. mensajes de cumpleaños).

Presupuesto de Fase 2: a definir tras ver el resultado de la Fase 1, con tope de no superar su precio.

### Preguntas ya resueltas

- Nº de clientas / clases por semana, tipo de plan (mensual + bono, confirmado ambos), migración desde Harbiz (no se migra histórico, se exporta CSV de pagos), quién asigna rutina (Elena e Iván), presupuesto/plazo (pendiente de que yo lo presente tras el prototipo).

### Próximos pasos acordados

- **Germán**: crear carpeta de Drive para assets (fotos/vídeos del gimnasio), construir prototipo básico en 1-2 semanas, presentar presupuesto basado en el alcance ya cerrado.
- **Elena e Iván**: subir assets a Drive, revisar el prototipo y dar feedback.
- **Prioridad de construcción**: 1) app de gestión (admin + cliente) para clientas existentes, 2) landing page estática sencilla con enlace de WhatsApp para captar leads nuevos — la landing va después, no en paralelo.

## 8. Prompt inicial para Claude Code

```
Construye una app a medida para un centro de entrenamiento grupal.

Stack: Next.js 15 App Router + TypeScript + Tailwind + shadcn/ui,
Supabase (auth con roles admin/cliente, Postgres con RLS, storage),
Stripe (checkout + suscripciones + webhooks), Resend, PWA (manifest + service worker).

Lee el archivo brief-app-centro-entrenamiento.md para el alcance completo,
el modelo de datos y los roles.

Empieza por el Sprint 1: inicializa el proyecto, crea las migraciones de
Supabase con el schema y las políticas RLS del brief, implementa auth con
los dos roles (admin/cliente), y el CRUD de clientes con ficha (datos,
plan, notas de rutina). Usa server actions, valida con zod, y deja seeds
de desarrollo con 1 centro, 2 clases y 3 clientes de ejemplo.
```

---

## 9. Corrección de reglas de negocio confirmada por Elena (2026-08-14)

Elena respondió por audio a varias preguntas pendientes. Una de las respuestas corrigió una regla de negocio que se había construido al revés en el Sprint 3 (migración 0017). El resto son piezas nuevas que estaban bloqueadas hasta tener su respuesta.

### Regla de cancelación (invierte lo que decía el punto 7)

La compensación por cancelar con antelación depende del **tipo de plan**, no al revés de como se había implementado:

- **Clienta de BONO**: cancela con **≥24h** → se le **devuelve el crédito** que se había descontado al reservar. No se emite ningún bono de recuperación ni cuenta contra ningún tope. Cancela con **<24h** → el crédito se pierde (sin cambios).
- **Clienta de MENSUALIDAD**: cancela con **≥24h** → se le emite un **bono de recuperación** que caduca el **último día del mes natural en que se genera** (corregido el 2026-08-14: no era un plazo fijo de días), con el tope mensual de siempre según `dias_semana_habituales` (1/mes si 1-2 días, 2/mes si 3+). Cancela con **<24h** → no pasa nada (una mensual no consume créditos, no hay nada que compensar).

Antes estaba construido justo al revés: el bono de recuperación se emitía solo a clientas de bono (sin devolverles nunca el crédito original), y las mensuales no recibían ninguna compensación. Para poder devolver el crédito exacto de una clienta de bono hizo falta añadir `reservas.bono_id`, que registra de qué bono salió el crédito al reservar — antes no quedaba rastro de cuál se había descontado.

**Resuelto el 2026-08-14**: cuando Elena saca a una clienta de bono de una clase, el crédito se comporta exactamente igual que si cancelara la propia clienta — con ≥24h se devuelve, con <24h se pierde. No hace falta ninguna regla especial para cuando es Elena quien la saca: `cancelar_reserva` ya no distingue quién la llama, solo el plan y la antelación, así que esto ya estaba resuelto sin cambio de código.

### `bonos_cliente.fecha_caducidad` editable a mano

Elena necesita poder fijar ella la caducidad de un bono que asigna manualmente, como hacía en Harbiz — hoy `crear_bono` siempre la calculaba sola (+3 meses normal, fin del mes natural de compra para recuperación). Ahora acepta una fecha opcional que la sobreescribe. Tiene una pantalla mínima nueva en la ficha de la clienta ("Asignar bono") para poder usarlo.

### `copiar_semana` ya no apunta a nadie

Copiar la semana debe crear únicamente las horas del horario fijo (día/hora/aforo/entrenador, vía la clase-plantilla) — **no debe crear ninguna reserva**, ni de clientas de bono ni de mensualidad. Antes copiaba las reservas confirmadas de las mensuales (decisión tomada durante el Sprint de reglas de negocio, ver punto 7); Elena la revirtió: cada clienta reserva su plaza, la copia solo abre el hueco.

Además, el calendario ahora permite **eliminar una sesión suelta** después de copiar la semana (para festivos y ajustes puntuales), sin tocar el resto del horario fijo. Bloqueado si la sesión tiene reservas activas — hay que cancelarlas primero, para que cada clienta reciba la compensación que le corresponda en vez de perderla en cascada.

### Explícitamente fuera todavía (no adivinar, falta respuesta de Elena)

- El sistema de deuda por inasistencia (ya existe `clientes.deuda_creditos` y se descuenta al crear un bono nuevo, pero no se ha tocado ni ampliado con esta ronda de respuestas).

Las otras dos dudas que quedaron abiertas en la primera tanda de respuestas (crédito al sacar con <24h, y "mover" una reserva) las cerró Elena en la segunda tanda — ver punto 10.

## 10. Cierre del proyecto — segunda tanda de respuestas de Elena (2026-08-14)

Misma sesión de audios, resolviendo lo que quedaba abierto del punto 9 y añadiendo el catálogo de precios real.

### Ficha de clienta: sesiones de bono consumidas

Nueva sección en la ficha (solo panel de Elena) con la lista de reservas que descontaron un crédito de bono, cada una con dos acciones manuales independientes: **devolver crédito de esta sesión** (`creditos_usados -= 1` sobre el bono al que se cargó) y **añadir sesión extra al bono** (`creditos_totales += 1`). No usa tabla nueva, se apoya en `reservas.bono_id` + `bonos_cliente`.

### "Mover reserva" resuelto sin función dedicada

No hacía falta ningún botón de "mover". Lo que faltaba era que el panel de admin pudiera **crear una reserva en nombre de una clienta**, no solo cancelarla — ya existía la mitad (cancelar), y `reservar_sesion` ya soportaba que el admin reserve en nombre de cualquier clienta (es el mismo mecanismo que le deja reservar en una sesión cerrada). Solo faltaba la pantalla: botón "Añadir clienta" en cada sesión de la vista de día del admin. Con eso, Elena cancela en un grupo y añade en otro manualmente.

### Catálogo real de planes (`planes.activo`)

- **Mensuales**: Básico 50€ (1 día/semana), Fit 90€ (2 días/semana), Fit Plus 130€ (3 días/semana). `clases_incluidas` queda como dato informativo (1/2/3) — **sin ningún límite automático que impida reservar más clases de las que incluye el plan**, eso sigue sin construirse a propósito.
- **Bono**: dos precios conviven porque cambió con el tiempo — "Bono 12 sesiones" a 120€ es el precio antiguo, ya no se ofrece de alta a clientas nuevas pero sigue siendo válido para quien ya lo tenía; "Bono 10 sesiones" a 130€ es el que se ofrece hoy por defecto. Se añade también "Sesión de prueba" (1 clase, 15€) para gente nueva, mismo mecanismo de `bonos_cliente`, sin lógica especial.
- Se añadió `planes.activo boolean` (migración 0019) para poder retirar un plan de los selectores de alta nueva sin romper los `plan_id` que ya lo referencian desde `clientes`, `bonos_cliente` o `pagos`. **Regla operativa para el futuro: un cambio de precio siempre crea una fila nueva en `planes`, nunca edita el precio de una existente** — si no, cambiaría retroactivamente lo que ya pagan las clientas con el plan antiguo.
- `bonos_cliente.fecha_caducidad` por defecto sigue siendo compra + 3 meses (ver punto 9), sin tope de cancelaciones dentro de esos 3 meses para clientas de bono — solo la regla de 24h.
- El catálogo real (`scripts/seed.ts`) sustituye a los dos planes de ejemplo ("Cuota mensual" 45€, "Bono 10 clases" 80€). Aplicar requiere `npm run reset:dev` + `npm run seed` contra el proyecto real — es destructivo con los datos de demo actuales, así que no se ha ejecutado solo, queda pendiente de que Germán lo lance cuando le venga bien.

### Restricción importante para cuando se construya Stripe (Sprint 3, todavía sin empezar)

Nada de enlace público de compra de bono — ni en la landing ni en ningún sitio sin login. La compra/renovación se hace **solo autenticada, desde dentro de la app**: la clienta pulsa "renovar" y un server action genera la Stripe Checkout Session en el momento, usando el `stripe_price_id` del plan que tiene asignado **ella en concreto**, no un precio genérico. Motivo: los precios han cambiado con el tiempo (ver el `planes.activo` de arriba) y no todas las clientas pagan lo mismo — quien se dio de alta con el precio antiguo lo conserva hasta que Elena la cambie de plan a mano. Anotado aquí para que quien construya el Sprint 3 no lo resuelva con un link genérico.

### Nota de diseño para Sprint 5 (no construir todavía)

En la ficha de clienta: para bonos, mostrar si está pagado, fecha de compra y lista de fechas de sesiones usadas (la lista de "sesiones de bono consumidas" de arriba ya cubre buena parte de esto). Para todas las clientas, un historial mensual de asistencia que incluya también las reservas sin asistencia marcada, no solo las que sí se marcaron.

### Sigue explícitamente fuera (no adivinar)

- El sistema de deuda por inasistencia.
- Cualquier límite automático que impida reservar más clases a la semana de las que incluye el plan mensual — `clases_incluidas` en los planes mensuales es solo dato informativo.

---

*Generado el 28 de julio de 2026. Pendiente: nombre del centro/de la app, y cerrar las preguntas del punto 7 con la clienta antes de arrancar el Sprint 1.*
