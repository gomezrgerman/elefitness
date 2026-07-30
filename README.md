# Elefitness — demo

Prototipo clicable, sin backend, del panel de un centro de entrenamiento
grupal (reservas de clase con aforo, pagos, clientes). Construido para
enseñarle a la clienta cómo funcionaría la app antes de presupuestar el
proyecto real.

## Que es y que no es

- Todos los datos (clases, clientes, reservas, pagos) viven en memoria
  (`lib/mock-data.ts` + `lib/mock-store.tsx`) y **se resetean al recargar
  la pagina**.
- No hay login real: la pantalla de inicio (`/`) es un selector de rol
  que simula entrar como Elena (admin), Ivan (entrenador) o una de las
  tres clientas de ejemplo.
- No hay Supabase, Stripe, Resend ni PWA todavia — eso es el Sprint 1
  real, descrito en `Claude.MD` y `brief-app-centro-entrenamiento.md`,
  que arranca una vez se apruebe el proyecto.

## Correr en local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

## Desplegar gratis en Vercel

Requiere una cuenta gratuita en vercel.com (login interactivo, hazlo tu
mismo desde una terminal):

```bash
npx vercel login
npx vercel --prod
```

Sigue las preguntas del CLI (nombre del proyecto, framework detectado
automaticamente como Next.js). Al terminar imprime una URL publica —
esa es la que le mandas a la clienta.
