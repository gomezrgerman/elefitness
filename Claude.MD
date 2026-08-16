# CLAUDE.md

Este archivo guía a Claude Code en este repositorio. Lee también `brief-app-centro-entrenamiento.md` (raíz del proyecto) antes de tocar código — ahí está el alcance completo, el porqué de cada decisión y las preguntas aún pendientes con la clienta.

## Qué es esto

App a medida (no SaaS multi-tenant) para un centro de entrenamiento grupal. La dueña gestiona clases con aforo limitado; cada clienta reserva plaza y paga su cuota. Cada clienta tiene además un programa/rutina individual asignado por la entrenadora dentro de la clase grupal — eso se guarda como campo de texto en su ficha, no como motor de rutinas.

Inspirado en Harbiz (harbiz.io) pero **solo** el bloque de reservas + pagos + clientes. Nada de IA, nutrición, chat o marketing — ver sección "Fuera de alcance".

## Stack

- **Next.js 15** (App Router, Server Actions, TypeScript)
- **Tailwind + shadcn/ui**
- **Supabase**: Postgres + Auth + Row Level Security (RLS)
- **Stripe**: Checkout + Billing Portal + Webhooks (suscripciones)
- **Resend**: emails transaccionales (confirmación de reserva, aviso de cobro)
- **Zod**: validación de todos los server actions
- **Vercel**: deploy
- PWA: manifest.json + service worker, instalable desde el navegador móvil

## Comandos

```bash
npm run dev              # desarrollo local
npm run build            # build de producción
npm run lint              # eslint
supabase db push          # aplicar migraciones
supabase db reset         # reset local + seeds
```

(Ajustar si el scaffolding real difiere — actualizar esta sección en el primer commit.)

## Roles

Equipo real del centro: la dueña **Elena** (admin) y el entrenador **Ivan** (entrenador). Solo hay 2 miembros de staff, pero el modelo soporta añadir más entrenadores sin cambios de esquema.

- **admin** (Elena): crea/edita clases y horarios, da de alta/baja clientas, asigna plan y notas de rutina, gestiona pagos (altas, bonos manuales, moroso), control total.
- **entrenador** (Ivan): acceso de **solo lectura** al panel — ve la agenda de clases, qué clientes tiene cada día, las notas de rutina, y el estado de cobro/pagos de cada cliente. No puede crear/editar clases, dar de alta clientes, ni tocar pagos. Esto es para que se organice sin depender de preguntarle a Elena, sin darle permiso de modificar datos sensibles (cobros, altas/bajas).
- **cliente**: ve horario semanal, reserva/cancela clase eligiendo día y hora siempre que haya hueco (aforo libre), gestiona su suscripción desde el portal de Stripe si su plan es mensual.

RLS: cada tabla filtra por rol. `cliente_id = auth.uid()` para que una clienta nunca vea datos de otra. `entrenador` tiene policies de solo `SELECT` sobre clases/reservas/clientes/pagos — sin `INSERT`/`UPDATE`/`DELETE`. `admin` tiene policy propia con acceso completo de lectura y escritura.

## Modelo de datos (núcleo — ver brief para el detalle)

```
centro           (id, nombre, logo_url, color_marca, stripe_account_id)
users            (id, email, rol[admin|entrenador|cliente], nombre, telefono)
clientes         (id, user_id, estado[activo|baja], plan_id, notas_rutina, created_at)
planes           (id, nombre, precio, tipo[mensual|bono], clases_incluidas, stripe_price_id)
clases           (id, dia, hora_inicio, hora_fin, aforo_max, entrenador_id, recurrente boolean)
reservas         (id, clase_id, cliente_id, estado[confirmada|lista_espera|cancelada], created_at)
pagos            (id, cliente_id, plan_id, tipo[mensual|bono], metodo[stripe|efectivo|transferencia],
                  stripe_subscription_id, estado, importe, fecha_pago, ultimo_cobro, proximo_cobro,
                  registrado_por)
bonos_cliente    (id, cliente_id, plan_id, creditos_totales, creditos_usados, fecha_compra, activo)
```

Reglas de negocio clave:
- **Dos formas de pago conviven**: clientas con horario fijo pagan cuota **mensual** (suscripción recurrente vía Stripe, automática); clientas con horario rotativo (turnos de trabajo variables) compran **bonos** de clases sueltas, que pueden pagarse por Stripe (pago único) o en efectivo/transferencia — en ese caso Elena registra el pago manualmente en `pagos` (campo `metodo` + `registrado_por`).
- Los bonos consumen crédito de `bonos_cliente` en cada reserva confirmada (`creditos_usados += 1`) y lo devuelven si se cancela dentro del margen permitido. Si no quedan créditos, no se puede reservar.
- Al llenarse `aforo_max` de una clase, nuevas reservas pasan a `lista_espera`. Aforo actual: 4-5 personas/hora; previsto subir a 6-7 en septiembre 2026 — es solo un valor editable por clase, no requiere cambio de esquema.
- Cancelar con menos del margen configurado (ej. 4h antes) no libera plaza automáticamente para lista de espera — definir regla exacta con la clienta.
- El webhook de Stripe (`invoice.payment_failed`) marca al cliente como moroso; no lo da de baja automáticamente sin confirmarlo con la dueña.
- Cada clase reserva mostrada al cliente indica siempre día y hora (calendario de reservas), para que nunca tenga que preguntarle a Ivan cuándo entrena.

## Dentro de alcance (MVP)

Auth con 3 roles (admin, entrenador, cliente) · CRUD de clientes con registro completo de pagos (quién, cuándo, cómo y qué plan) · calendario de clases donde el cliente elige día/hora según hueco disponible · reservas con control de aforo y lista de espera · pagos mensuales recurrentes con Stripe **y** bonos de clases con crédito consumible (Stripe o registro manual en efectivo/transferencia) · panel de admin para la dueña (control total) y panel de solo lectura para el entrenador (agenda, notas, cobros) · emails transaccionales · PWA instalable.

## Fuera de alcance (no construir sin que Germán lo apruebe primero)

Creador de rutinas con IA, planificación nutricional, chat, comunidad, desafíos/logros, referidos, apps nativas (App Store/Google Play), dashboard financiero avanzado, multi-centro/multi-tenant.

Si una tarea pide algo de esta lista, parar y preguntar antes de implementar — probablemente es scope creep frente al MVP acordado con la clienta.

## Convenciones de código

- Server actions para toda mutación de datos (no API routes salvo webhooks de Stripe).
- Validar siempre con Zod antes de tocar Supabase.
- Nombres de tablas y campos en español (coherente con el dominio del negocio y con el resto de proyectos de Germán — G2Fit, NutriFlow).
- Componentes en `app/`, lógica de datos en `lib/`, tipos generados de Supabase en `lib/database.types.ts`.
- Seeds de desarrollo: 1 centro, usuarios Elena (admin) e Ivan (entrenador), 2 clases con aforo 5, 3 clientes de ejemplo — uno con plan mensual y reserva confirmada, uno con bono y crédito consumido en lista de espera, uno moroso (pago mensual fallido) — para poder enseñar el MVP con datos realistas.

## Roadmap de sprints (para ir marcando progreso aquí)

- [x] **Sprint 1** — Setup repo, Supabase (schema + RLS), auth 3 roles (admin/entrenador/cliente), CRUD de clientes
- [x] **Sprint 2** — Calendario de clases + reservas con aforo y lista de espera + panel de solo lectura del entrenador (ampliado con rejilla de huecos, restricción por entrenador, copiar semana, añadir clienta a una sesión)
- [ ] **Sprint 3** — Pagos: registro manual y bonos con crédito consumible YA HECHOS (con las reglas de cancelación corregidas por Elena el 2026-08-14). **Falta Stripe entero**: checkout autenticado desde dentro de la app usando el `stripe_price_id` de cada clienta (nunca link público — ver brief punto 10), suscripciones recurrentes, webhooks de alta/baja por cobro fallido, export CSV
- [ ] **Sprint 4** — Panel de la dueña YA HECHO. Falta: emails transaccionales (Resend), PWA (manifest + service worker), dominio propio (hoy en `elefitness.vercel.app`)

Marcar cada sprint como hecho aquí mismo según se cierre, para que la siguiente sesión de Claude Code sepa dónde retomar.

## Antes de la demo a la clienta

Confirmar con Germán que las preguntas del punto 7 del brief están cerradas (nº de clientas, tipo de plan, migración de datos de Harbiz, quién asigna rutinas, dominio, presupuesto/plazo) — si alguna sigue abierta, el Sprint 3 (Stripe) puede necesitar ajustes.
