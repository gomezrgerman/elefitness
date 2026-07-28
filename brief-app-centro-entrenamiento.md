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

## 7. Preguntas para la reunión con la clienta

- ¿Cuántas clientas activas tiene ahora y cuántas clases a la semana da?
- ¿Los planes son cuota mensual fija, bono de clases, o ambos?
- ¿Necesita migrar clientas/histórico desde Harbiz o empieza de cero?
- ¿Quién asigna la rutina individual dentro de la clase — ella sola o hay más de una entrenadora/monitor?
- ¿Tiene dominio propio o hay que gestionarlo?
- ¿Presupuesto y plazo que maneja para el proyecto?

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

*Generado el 28 de julio de 2026. Pendiente: nombre del centro/de la app, y cerrar las preguntas del punto 7 con la clienta antes de arrancar el Sprint 1.*
