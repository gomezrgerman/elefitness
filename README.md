# Elefitness

Panel del centro de entrenamiento grupal: reservas de clase con aforo,
pagos, clientes. Backend real sobre Supabase (Postgres + Auth + RLS).

## Que es y que no es

- Los datos viven en un proyecto Supabase real (`pdvpruktssojuicwhhlt`),
  no en memoria — se conservan entre recargas y despliegues.
- Login real con Supabase Auth. `/login` tiene un formulario de
  email/contraseña y un panel de "Acceso rápido (solo demo)" con las 5
  cuentas semilla (Elena, Ivan, Maria, Laura, Sara) para cambiar de rol
  rápido en una demo.
- No hay Stripe checkout, Resend ni PWA todavia — eso es Sprint 3/4 real,
  descrito en `Claude.MD` y `docs/superpowers/specs/2026-07-31-sprint1-supabase-design.md`.

## Correr en local

```bash
npm install
cp .env.local.example .env.local   # si no existe ya .env.local con las credenciales de Supabase
npm run seed                        # solo la primera vez, contra un proyecto Supabase vacio
npm run dev
```

Abre `http://localhost:3000` — redirige a `/login`.

## Tests de integración

Corren contra el proyecto Supabase real (no mocks), usando las cuentas
semilla creadas por `npm run seed`:

```bash
npm run test:integration
```

## Desplegar en Vercel

```bash
npx vercel login
npx vercel --prod
```

En la configuración de Vercel, añade las env vars `NEXT_PUBLIC_SUPABASE_URL`
y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **No** subas `SUPABASE_SERVICE_ROLE_KEY`
a Vercel — se usa solo en local para `npm run seed`.
