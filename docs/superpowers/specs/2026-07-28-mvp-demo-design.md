# Elefitness — MVP de demo (sin backend) — Design Spec

**Fecha:** 2026-07-28
**Estado:** Aprobado por Germán

## Contexto y objetivo

Antes de arrancar el Sprint 1 real descrito en `Claude.MD` (Supabase + RLS +
Stripe + Resend), Germán necesita un prototipo clicable y gratuito que
enviarle a Elena (la dueña del centro) para que vea cómo funcionaría la app
y así cerrar la propuesta/presupuesto. Este documento describe **ese
prototipo de venta**, no el Sprint 1 de producción — el roadmap de
`Claude.MD` sigue vigente sin cambios y se retoma tal cual una vez el
proyecto se apruebe.

No confundir con el roadmap de sprints del `Claude.MD`: este demo no marca
ningún sprint como completado allí.

## Alcance

### Dentro

- Proyecto Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui —
  mismo stack que se usará en el proyecto real, para poder evolucionar
  directamente a él sustituyendo solo la capa de datos.
- Datos de ejemplo en memoria (`lib/mock-data.ts`), con el escenario de
  seeds del brief:
  - 1 centro.
  - Elena (rol admin), Ivan (rol entrenador).
  - 2 clases con aforo máximo 5.
  - 3 clientas: una con plan mensual y reserva confirmada, una con bono y
    crédito consumido en lista de espera, una morosa (pago mensual
    fallido).
- Selector de rol visible (Elena / Ivan / clienta) que cambia la vista
  renderizada — sustituye el login real de Supabase Auth para este demo.
- Panel Elena (admin): CRUD de clientes en memoria (alta/baja, plan, notas
  de rutina), calendario semanal de clases con aforo y lista de quién
  reservó, estado de cobros por clienta.
- Panel Ivan (entrenador): mismas vistas que Elena pero **solo lectura**
  — sin controles de edición, alta/baja ni pagos.
- Vista clienta: horario semanal, reservar/cancelar clase (afecta aforo y
  lista de espera en memoria), ver su plan/bono y estado de pago.
- Reglas de negocio simuladas en memoria: aforo máximo, paso automático a
  lista de espera al llenarse una clase, consumo de crédito de bono al
  reservar.
- Deploy en Vercel (plan gratuito) para obtener una URL pública que
  enviarle a Elena.

### Fuera de este demo (se implementan en el Sprint 1 real de `Claude.MD`)

- Supabase (Postgres, Auth, RLS).
- Stripe (checkout, suscripciones, webhooks).
- Resend (emails transaccionales).
- PWA (manifest, service worker).
- Persistencia real de cualquier tipo — todos los cambios hechos en la
  demo se pierden al recargar la página.

## Decisiones clave

| Decisión | Elegido | Alternativas descartadas |
|---|---|---|
| Backend/BD | Ninguno — mock data en memoria | Supabase local (bloqueado: sin Docker instalado); Supabase cloud (fricción de crear proyecto antes de tener presupuesto aprobado) |
| Auth | Selector de rol visible, sin login real | Login simulado con contraseñas falsas (más trabajo, se descarta igual al meter Supabase real) |
| Persistencia de datos | Ninguna — estado en memoria de React, se resetea al recargar | localStorage (se descartó para mantener el demo simple) |
| Testing | Sin TDD estricto — validación manual en navegador | TDD completo (aplica en el Sprint 1 real, no en este prototipo desechable) |
| Deploy | Vercel free tier con URL pública | Solo local con captura de pantalla/vídeo |

## Componentes

- `lib/mock-data.ts` — datos de ejemplo tipados (centro, users, clientes,
  planes, clases, reservas, pagos, bonos_cliente) siguiendo los nombres de
  tabla/campo en español de `Claude.MD`.
- `lib/mock-store.ts` (o context de React) — estado en memoria que expone
  las acciones simuladas: reservar, cancelar, dar de alta/baja cliente,
  editar plan/notas. Sin llamadas a red.
- Selector de rol — componente en el layout raíz o en una página de
  entrada (`/`), guarda el rol activo en estado de React (no persiste
  entre recargas, ya que los datos tampoco persisten).
- `app/admin/...` — vistas de Elena.
- `app/entrenador/...` — vistas de Ivan (solo lectura, reutilizando
  componentes de admin sin los controles de edición).
- `app/cliente/...` — vista de una clienta.

## Fuera de discusión / ambigüedades resueltas

- El demo no incluye registro/invitación de nuevas clientas — el
  selector de rol ya trae las 3 clientas de ejemplo precargadas.
- No hay lógica de expiración de bonos ni renovación automática de
  mensualidad — solo el estado inicial de los seeds y las acciones que
  el usuario dispare durante la demo (reservar/cancelar/alta/baja).
- El límite de horas para cancelar una reserva se simula con un valor
  fijo razonable (4h, igual que el ejemplo de `Claude.MD`) ya que la
  regla exacta sigue pendiente de confirmar con la clienta.
