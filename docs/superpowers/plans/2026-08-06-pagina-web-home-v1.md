# Elefitness Marketing Site — Home v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working version of the Elefitness public marketing website — a single Home page (`/`) — as a standalone Next.js project inside `pagina web/`, per `pagina web/CLAUDE.md` and `docs/superpowers/specs/2026-08-06-pagina-web-home-v1-design.md`.

**Architecture:** Next.js 16 App Router project scaffolded directly into `pagina web/` (its own `package.json`, fully independent from the root repo's booking/management app). Presentational, mostly-static Home page assembled from small Server Components; a thin `"use client"` layer only where interactivity/animation requires it (header scroll state, mobile menu, accordion, GSAP/Lenis/Framer Motion). All content (services, team, testimonials, FAQ, site info) lives in typed data files under `content/`, with placeholders standing in for anything not yet confirmed by the client (photos, tarifas, Harbiz link, address, phone).

**Tech Stack:** Next.js 16.3.0, React 19, TypeScript (strict), Tailwind CSS v4 (CSS-based `@theme`, no `tailwind.config.ts`), GSAP + ScrollTrigger, Lenis (smooth scroll), Framer Motion (mobile menu + FAQ accordion only), Embla Carousel (draggable community gallery), Lucide React (icons), `next/font/google` (Manrope).

## Global Constraints

These apply to every task below; they are copied verbatim or directly derived from `pagina web/CLAUDE.md` and the approved design spec.

- **Working directory:** every command in this plan runs with cwd = `pagina web/` (the project root for this Next.js app), unless a step explicitly says otherwise. Nothing for this project is created outside `pagina web/`.
- **Scope:** only the Home page (`/`) ships in this plan. No `/servicios`, `/equipo`, `/actividades`, `/contacto`, or legal pages yet — internal links use in-page anchors (`#modalidades`, `#filosofia`, `#equipo`, `#contacto`) instead of routes that don't exist yet.
- **No invented data:** no real address, phone, tarifas, testimonials, Harbiz URL, or photos exist yet. Every such value is a clearly labeled placeholder (visible "pendiente" text, or a `MediaCard` placeholder block) — never presented as if real. Exception: `Elefitness`, `Valencia`, and the team members' real names/roles (Elena — dueña, Ivan — entrenador) are already confirmed facts and are used as-is.
- **No `next/image` yet:** since there are no real photo assets, sections use the `MediaCard` placeholder component instead of `next/image`. Swapping in `next/image` with real assets is future work, not part of this plan.
- **Color tokens** (`pagina web/CLAUDE.md` section 5), used verbatim:
  `--color-bg:#171918 --color-bg-soft:#232625 --color-surface:#2D3130 --color-surface-light:#F1F1ED --color-white:#F8F8F4 --color-text:#F4F4EF --color-text-dark:#161817 --color-muted:#A7ADAA --color-border:rgba(255,255,255,0.14) --color-accent:#78A8A2 --color-accent-soft:#A9C7C2 --color-accent-dark:#527D78`
- **Type scale** (section 6): `--text-xs:0.75rem --text-sm:0.875rem --text-base:1rem --text-lg:1.125rem --text-xl:1.375rem --text-2xl:1.75rem --text-3xl:2.25rem --text-hero:clamp(3.5rem,9vw,9rem) --text-section:clamp(2.6rem,6vw,6.5rem) --text-heading:clamp(2rem,4vw,4rem) --text-body-large:clamp(1.125rem,1.6vw,1.5rem)`. Font: Manrope (via `next/font/google`), no more than two font families.
- **Radius tokens** (section 8): `--radius-sm:0.75rem --radius-md:1.25rem --radius-lg:2rem --radius-xl:3rem --radius-pill:999px`.
- **Animation rules** (sections 22, 27): GSAP animations must use `gsap.context()` + `context.revert()` on unmount; animate only `transform`/`opacity`; every animated component must degrade gracefully under `prefers-reduced-motion: reduce`; GSAP and Framer Motion are never mixed on the same element; Framer Motion is reserved for the mobile menu and the FAQ accordion only.
- **Accessibility:** WCAG 2.2 AA target. Minimum touch target 44×44px. Keyboard-operable accordion and mobile menu (`aria-expanded`, `aria-controls`, Escape-to-close, focus-visible states). Decorative icons get `aria-hidden="true"`.
- **External links** (section 19): every link to Harbiz or Instagram opens in a new tab with `rel="noopener noreferrer"` and never disguises that it leaves the site.
- **Code conventions** (section 25/26): Server Components by default, `"use client"` only where interactivity/browser APIs are required; TypeScript strict, no `any`; Tailwind classes read from the tokens above, no ad hoc arbitrary values duplicating an existing token; use semantic `<Link>`/`<a>` for navigation, `<button>` for actions — never the other way around.
- **Verification approach for this plan:** this is a presentational marketing site with no business logic to unit test, so — consistent with `pagina web/CLAUDE.md` section 38's own workflow — each task is verified with `npm run lint` and `npm run typecheck` (not unit tests). Full integration (`npm run build` + a real browser pass across breakpoints, reduced motion, and keyboard nav) happens once in the final task, after every piece is wired together.

---

## File Structure

```
pagina web/
├── CLAUDE.md                              # existing design doc (moved back in after scaffold)
├── package.json
├── src/
│   ├── app/
│   │   ├── layout.tsx                     # Task 12
│   │   ├── page.tsx                       # Task 12
│   │   └── globals.css                    # Task 2
│   ├── components/
│   │   ├── layout/
│   │   │   ├── header.tsx                 # Task 6
│   │   │   ├── mobile-menu.tsx            # Task 6
│   │   │   └── footer.tsx                 # Task 6
│   │   ├── sections/
│   │   │   ├── hero.tsx                   # Task 7
│   │   │   ├── philosophy.tsx             # Task 7
│   │   │   ├── services.tsx               # Task 8
│   │   │   ├── training-experience.tsx    # Task 8
│   │   │   ├── community.tsx              # Task 9
│   │   │   ├── testimonials.tsx           # Task 9
│   │   │   ├── team.tsx                   # Task 10
│   │   │   ├── faq.tsx                    # Task 10
│   │   │   └── final-cta.tsx              # Task 11
│   │   ├── ui/
│   │   │   ├── button.tsx                 # Task 4
│   │   │   ├── external-link.tsx          # Task 4
│   │   │   ├── section-label.tsx          # Task 4
│   │   │   ├── media-card.tsx             # Task 4
│   │   │   ├── accordion.tsx              # Task 4
│   │   │   └── animated-heading.tsx       # Task 5
│   │   └── motion/
│   │       ├── smooth-scroll-provider.tsx # Task 5
│   │       ├── reveal-text.tsx            # Task 5
│   │       ├── parallax-media.tsx         # Task 5
│   │       └── horizontal-scroll.tsx      # Task 5
│   ├── content/
│   │   ├── site.ts                        # Task 3
│   │   ├── services.ts                    # Task 3
│   │   ├── testimonials.ts                # Task 3
│   │   ├── team.ts                        # Task 3
│   │   └── faqs.ts                        # Task 3
│   ├── lib/
│   │   └── utils.ts                       # Task 3
│   └── types/
│       └── index.ts                       # Task 3
```

---

### Task 1: Scaffold the Next.js project and install dependencies

**Files:**
- Create: entire `pagina web/` Next.js project (generated by `create-next-app`), plus `pagina web/CLAUDE.md` (restored)
- Modify: `pagina web/package.json` (add `typecheck` script)

**Interfaces:**
- Produces: a working Next.js 16 project at `pagina web/` with `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck` all runnable; `gsap`, `lenis`, `framer-motion`, `lucide-react`, `embla-carousel-react` installed as dependencies.

- [ ] **Step 1: Move the existing design doc out of the way**

The `pagina web/` directory currently contains only `CLAUDE(2).md`. `create-next-app` refuses to scaffold into a non-empty directory, so move that file up one level temporarily.

Run (cwd = `pagina web/`):
```bash
mv "CLAUDE(2).md" "../pagina-web-claude-source.md"
```

- [ ] **Step 2: Scaffold the Next.js project**

Run (cwd = `pagina web/`):
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```
Expected: completes with "Success! Created ... at .../pagina web", installs `next`, `react`, `react-dom`, `tailwindcss`, `@tailwindcss/postcss`, `eslint`, `eslint-config-next`, `typescript`. Produces `src/app/{layout.tsx,page.tsx,globals.css}`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `package.json`, `public/*.svg`, and a generated `CLAUDE.md` (containing just `@AGENTS.md`) + `AGENTS.md` (Next.js 16 agent breaking-changes notice).

- [ ] **Step 3: Restore the design doc as the project's canonical CLAUDE.md**

The generated `CLAUDE.md` is a one-line stub (`@AGENTS.md`). Our real design doc is the actual project instructions for this codebase, so it replaces the stub — do not keep both.

Run (cwd = `pagina web/`):
```bash
rm CLAUDE.md
mv "../pagina-web-claude-source.md" "CLAUDE.md"
```
Leave the generated `AGENTS.md` in place as-is (it's auto-regenerated by `next dev`/`next build` and documents real Next.js 16 breaking-changes guidance — see its own note about `node_modules/next/dist/docs/`).

- [ ] **Step 4: Remove unused default template assets**

Run (cwd = `pagina web/`):
```bash
rm public/next.svg public/vercel.svg public/file.svg public/globe.svg public/window.svg
```

- [ ] **Step 5: Install animation, icon, and carousel dependencies**

Run (cwd = `pagina web/`):
```bash
npm install gsap lenis framer-motion lucide-react embla-carousel-react
```
Expected: all five added to `dependencies` in `package.json`, `npm install` exits 0.

- [ ] **Step 6: Add a `typecheck` script**

Edit `pagina web/package.json`, in the `"scripts"` object, add:
```json
"typecheck": "tsc --noEmit"
```
so the `scripts` block reads:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 7: Verify the toolchain works end-to-end**

Run (cwd = `pagina web/`):
```bash
npm run lint
npm run typecheck
npm run build
```
Expected: all three exit 0 against the untouched scaffold output.

- [ ] **Step 8: Commit**

```bash
cd "pagina web"
git add -A
git commit -m "chore: scaffold Elefitness marketing site Next.js project"
```

---

### Task 2: Design tokens and global styles

**Files:**
- Modify: `pagina web/src/app/globals.css`

**Interfaces:**
- Produces: Tailwind utility classes for every token in Global Constraints — colors (`bg-bg`, `bg-bg-soft`, `bg-surface`, `bg-surface-light`, `bg-white`, `text-text`, `text-text-dark`, `text-muted`, `border-border`, `bg-accent`/`text-accent`, `bg-accent-soft`/`text-accent-soft`, `bg-accent-dark`/`text-accent-dark`), font families (`font-display`, `font-body` — resolved once Task 12 defines `--font-manrope`), text sizes (`text-xs` … `text-3xl`, `text-hero`, `text-section`, `text-heading`, `text-body-large`), radii (`rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-pill`). Also defines the global `prefers-reduced-motion: reduce` override required by every later animated component.

- [ ] **Step 1: Replace the generated theme with Elefitness tokens**

Replace the full contents of `pagina web/src/app/globals.css` with:

```css
@import "tailwindcss";

@theme {
  --color-bg: #171918;
  --color-bg-soft: #232625;
  --color-surface: #2d3130;
  --color-surface-light: #f1f1ed;
  --color-white: #f8f8f4;
  --color-text: #f4f4ef;
  --color-text-dark: #161817;
  --color-muted: #a7adaa;
  --color-border: rgba(255, 255, 255, 0.14);
  --color-accent: #78a8a2;
  --color-accent-soft: #a9c7c2;
  --color-accent-dark: #527d78;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.375rem;
  --text-2xl: 1.75rem;
  --text-3xl: 2.25rem;
  --text-hero: clamp(3.5rem, 9vw, 9rem);
  --text-section: clamp(2.6rem, 6vw, 6.5rem);
  --text-heading: clamp(2rem, 4vw, 4rem);
  --text-body-large: clamp(1.125rem, 1.6vw, 1.5rem);

  --radius-sm: 0.75rem;
  --radius-md: 1.25rem;
  --radius-lg: 2rem;
  --radius-xl: 3rem;
  --radius-pill: 999px;
}

/*
  next/font exposes the loaded font as a CSS variable set via a className
  on <html> (wired in Task 12). `@theme inline` references it directly
  instead of baking in a static value, matching how create-next-app's own
  generated globals.css wires --font-sans to --font-geist-sans.
*/
@theme inline {
  --font-display: var(--font-manrope), sans-serif;
  --font-body: var(--font-manrope), sans-serif;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Verify**

Run (cwd = `pagina web/`):
```bash
npm run lint
npm run typecheck
```
Expected: both exit 0 (CSS isn't type-checked or linted by these commands, but this confirms Step 1 didn't break the TS/ESLint setup).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: wire Elefitness design tokens into Tailwind v4 theme"
```

---

### Task 3: Shared types, utils, and content data

**Files:**
- Create: `pagina web/src/types/index.ts`
- Create: `pagina web/src/lib/utils.ts`
- Create: `pagina web/src/content/site.ts`
- Create: `pagina web/src/content/services.ts`
- Create: `pagina web/src/content/testimonials.ts`
- Create: `pagina web/src/content/team.ts`
- Create: `pagina web/src/content/faqs.ts`

**Interfaces:**
- Produces: `cn(...classes: Array<string | false | null | undefined>): string` from `@/lib/utils`.
- Produces types: `Service`, `Testimonial`, `TeamMember`, `Faq`, `SiteConfig` from `@/types`.
- Produces data: `siteConfig: SiteConfig` from `@/content/site`; `services: Service[]` from `@/content/services`; `testimonials: Testimonial[]` from `@/content/testimonials`; `team: TeamMember[]` from `@/content/team`; `faqs: Faq[]` from `@/content/faqs`.

- [ ] **Step 1: Write shared types**

Create `pagina web/src/types/index.ts`:
```ts
export interface Service {
  id: string;
  number: string;
  name: string;
  description: string;
  benefit: string;
  audience: string;
}

export interface Testimonial {
  id: string;
  name: string;
  quote: string;
  timeTraining: string;
  isPlaceholder: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

export interface SiteConfig {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  instagramUrl: string;
  hours: string;
  harbizUrl: string;
}
```

- [ ] **Step 2: Write the `cn` class-merging utility**

Create `pagina web/src/lib/utils.ts`:
```ts
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
```

- [ ] **Step 3: Write site config content**

Create `pagina web/src/content/site.ts`:
```ts
import type { SiteConfig } from "@/types";

// Placeholder values pending confirmation from Elena — do not treat as real.
export const siteConfig: SiteConfig = {
  name: "Elefitness",
  tagline: "Entrena para vivir mejor.",
  address: "Dirección pendiente de confirmar",
  phone: "Teléfono pendiente de confirmar",
  instagramUrl: "#",
  hours: "Horario pendiente de confirmar",
  harbizUrl: "#",
};
```

- [ ] **Step 4: Write services (modalidades) content**

Create `pagina web/src/content/services.ts`:
```ts
import type { Service } from "@/types";

export const services: Service[] = [
  {
    id: "entrenamiento-personal",
    number: "01",
    name: "Entrenamiento personal",
    description:
      "Una planificación adaptada a tu nivel, tus objetivos y tu evolución, con seguimiento durante cada sesión.",
    benefit: "Seguimiento 100% individual",
    audience: "Para quienes buscan un plan hecho a su medida",
  },
  {
    id: "grupos-reducidos",
    number: "02",
    name: "Grupos reducidos",
    description:
      "Entrena acompañado en grupos pequeños, con la misma atención personalizada y un ambiente cercano.",
    benefit: "Comunidad y motivación",
    audience: "Para quienes prefieren entrenar en compañía",
  },
  {
    id: "entrenamiento-fuerza",
    number: "03",
    name: "Entrenamiento de fuerza",
    description:
      "Trabaja tu fuerza de forma progresiva y segura, adaptada a tu punto de partida.",
    benefit: "Más fuerza para el día a día",
    audience: "Para quienes quieren ganar fuerza real",
  },
  {
    id: "mayores-50",
    number: "04",
    name: "Entrenamiento para mayores de 50",
    description:
      "Sesiones pensadas para mantener movilidad, fuerza y autonomía con total seguridad.",
    benefit: "Movilidad y autonomía",
    audience: "Para quienes quieren cuidarse a cualquier edad",
  },
  {
    id: "yoga",
    number: "05",
    name: "Yoga",
    description:
      "Sesiones para mejorar tu movilidad, tu respiración y tu bienestar general.",
    benefit: "Movilidad y calma",
    audience: "Para quienes buscan equilibrio entre cuerpo y mente",
  },
  {
    id: "gap",
    number: "06",
    name: "GAP",
    description:
      "Trabajo específico de glúteos, abdomen y piernas en un formato dinámico y guiado.",
    benefit: "Tono y fuerza en tren inferior",
    audience: "Para quienes quieren un entrenamiento dirigido y específico",
  },
  {
    id: "bailoterapia",
    number: "07",
    name: "Bailoterapia",
    description:
      "Entrena mientras te mueves al ritmo de la música, en un ambiente distendido y motivador.",
    benefit: "Cardio con buen ambiente",
    audience: "Para quienes prefieren entrenar disfrutando",
  },
  {
    id: "body-combat",
    number: "08",
    name: "Body Combat",
    description:
      "Un entrenamiento cardiovascular de alta energía inspirado en artes marciales, sin contacto.",
    benefit: "Energía y resistencia",
    audience: "Para quienes buscan un entrenamiento intenso y dirigido",
  },
];
```

- [ ] **Step 5: Write testimonials placeholder content**

Create `pagina web/src/content/testimonials.ts`:
```ts
import type { Testimonial } from "@/types";

// All entries below are example placeholders, not real reviews.
// Replace with real, authorized testimonials before launch (CLAUDE.md 16.3).
export const testimonials: Testimonial[] = [
  {
    id: "placeholder-1",
    name: "Nombre pendiente",
    quote:
      "Testimonio de ejemplo pendiente de sustituir por una reseña real de una clienta o cliente de Elefitness.",
    timeTraining: "Antigüedad pendiente",
    isPlaceholder: true,
  },
  {
    id: "placeholder-2",
    name: "Nombre pendiente",
    quote:
      "Testimonio de ejemplo pendiente de sustituir por una reseña real de una clienta o cliente de Elefitness.",
    timeTraining: "Antigüedad pendiente",
    isPlaceholder: true,
  },
  {
    id: "placeholder-3",
    name: "Nombre pendiente",
    quote:
      "Testimonio de ejemplo pendiente de sustituir por una reseña real de una clienta o cliente de Elefitness.",
    timeTraining: "Antigüedad pendiente",
    isPlaceholder: true,
  },
];
```

- [ ] **Step 6: Write team content**

Create `pagina web/src/content/team.ts`:
```ts
import type { TeamMember } from "@/types";

// Names and roles are confirmed. Bio/specialty details are placeholders
// pending copy from Elena and Ivan.
export const team: TeamMember[] = [
  {
    id: "elena",
    name: "Elena",
    role: "Dueña de Elefitness",
    bio: "Biografía pendiente de confirmar.",
  },
  {
    id: "ivan",
    name: "Ivan",
    role: "Entrenador",
    bio: "Biografía pendiente de confirmar.",
  },
];
```

- [ ] **Step 7: Write FAQ content**

Create `pagina web/src/content/faqs.ts`:
```ts
import type { Faq } from "@/types";

export const faqs: Faq[] = [
  {
    id: "experiencia-previa",
    question: "¿Necesito experiencia previa?",
    answer:
      "No. Empezamos desde tu nivel actual y adaptamos cada sesión a tu punto de partida.",
  },
  {
    id: "nunca-entrenado",
    question: "¿Puedo empezar si nunca he entrenado?",
    answer:
      "Sí, es habitual empezar sin experiencia. El entrenamiento se adapta a ti, no al revés.",
  },
  {
    id: "personal-vs-grupo",
    question:
      "¿Qué diferencia hay entre entrenamiento personal y grupo reducido?",
    answer:
      "El entrenamiento personal es una sesión individual centrada solo en ti. Los grupos reducidos mantienen la misma atención personalizada, pero entrenando junto a otras pocas personas.",
  },
  {
    id: "personas-por-grupo",
    question: "¿Cuántas personas hay en cada grupo?",
    answer:
      "Los grupos son reducidos para poder mantener seguimiento individual dentro de la clase.",
  },
  {
    id: "molestias",
    question: "¿Puedo entrenar si tengo molestias?",
    answer:
      "Sí, adaptamos los ejercicios a tus limitaciones. Cuéntanoslo al empezar para ajustar tu plan.",
  },
  {
    id: "reservar",
    question: "¿Cómo se reservan las sesiones?",
    answer:
      "Las reservas se gestionan a través de Harbiz, nuestra plataforma de reservas. Te dirigiremos allí al reservar tu primera sesión.",
  },
  {
    id: "probar-antes",
    question: "¿Puedo probar antes de apuntarme?",
    answer:
      "Puedes reservar una primera sesión para conocer el centro y el método antes de decidir tu plan.",
  },
  {
    id: "que-llevar",
    question: "¿Qué debo llevar?",
    answer: "Ropa cómoda de entrenamiento, calzado deportivo y una botella de agua.",
  },
  {
    id: "como-funciona-harbiz",
    question: "¿Cómo funciona Harbiz?",
    answer:
      "Harbiz es la plataforma externa donde gestionamos reservas, altas y suscripciones. Al pulsar un botón de reserva, se abre en una pestaña nueva.",
  },
  {
    id: "mayores-50-actividades",
    question: "¿Hay actividades para mayores de 50 años?",
    answer:
      "Sí, tenemos sesiones pensadas específicamente para mantener movilidad, fuerza y autonomía con seguridad.",
  },
];
```

- [ ] **Step 8: Verify**

Run (cwd = `pagina web/`):
```bash
npm run lint
npm run typecheck
```
Expected: both exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/types src/lib src/content
git commit -m "feat: add shared types, cn utility, and Home page content data"
```

---

### Task 4: UI primitives (button, links, label, media card, accordion)

**Files:**
- Create: `pagina web/src/components/ui/external-link.tsx`
- Create: `pagina web/src/components/ui/button.tsx`
- Create: `pagina web/src/components/ui/section-label.tsx`
- Create: `pagina web/src/components/ui/media-card.tsx`
- Create: `pagina web/src/components/ui/accordion.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils` (Task 3); `Faq` type from `@/types` (Task 3).
- Produces: `ExternalLink({ href, showIcon?, className?, children, ...anchorProps })` from `@/components/ui/external-link`.
- Produces: `Button({ href, variant?: "primary" | "secondary", external?: boolean, className?, children })` from `@/components/ui/button`.
- Produces: `SectionLabel({ children, className? })` from `@/components/ui/section-label`.
- Produces: `MediaCard({ label, aspect?: "square" | "portrait" | "landscape", className? })` from `@/components/ui/media-card`.
- Produces: `Accordion({ items: Faq[] })` from `@/components/ui/accordion` (client component, uses `framer-motion`).

- [ ] **Step 1: Write `ExternalLink`**

Create `pagina web/src/components/ui/external-link.tsx`:
```tsx
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExternalLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  showIcon?: boolean;
}

export function ExternalLink({
  href,
  showIcon = true,
  className,
  children,
  ...props
}: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    >
      {children}
      {showIcon && (
        <ArrowUpRight aria-hidden="true" className="size-[1em]" />
      )}
    </a>
  );
}
```

- [ ] **Step 2: Write `Button`**

Create `pagina web/src/components/ui/button.tsx`:
```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ExternalLink } from "@/components/ui/external-link";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps {
  href: string;
  variant?: ButtonVariant;
  external?: boolean;
  className?: string;
  children: React.ReactNode;
}

const baseStyles =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-pill px-6 py-3 text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-text-dark hover:bg-accent-soft",
  secondary:
    "border border-border text-text hover:border-accent hover:text-accent",
};

export function Button({
  href,
  variant = "primary",
  external = false,
  className,
  children,
}: ButtonProps) {
  const classes = cn(baseStyles, variantStyles[variant], className);

  if (external) {
    return (
      <ExternalLink href={href} className={classes} showIcon={false}>
        {children}
      </ExternalLink>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
```

- [ ] **Step 3: Write `SectionLabel`**

Create `pagina web/src/components/ui/section-label.tsx`:
```tsx
import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <span
      className={cn(
        "inline-block text-xs font-semibold uppercase tracking-[0.2em] text-accent",
        className
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Write `MediaCard`**

Create `pagina web/src/components/ui/media-card.tsx`:
```tsx
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type MediaAspect = "square" | "portrait" | "landscape";

interface MediaCardProps {
  label: string;
  aspect?: MediaAspect;
  className?: string;
}

const aspectStyles: Record<MediaAspect, string> = {
  square: "aspect-square",
  portrait: "aspect-[3/4]",
  landscape: "aspect-[4/3]",
};

export function MediaCard({
  label,
  aspect = "landscape",
  className,
}: MediaCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-bg-soft text-center text-muted",
        aspectStyles[aspect],
        className
      )}
    >
      <ImageOff aria-hidden="true" className="size-6" />
      <span className="text-xs uppercase tracking-wide">{label}</span>
    </div>
  );
}
```

- [ ] **Step 5: Write `Accordion`**

Create `pagina web/src/components/ui/accordion.tsx`:
```tsx
"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Faq } from "@/types";

interface AccordionProps {
  items: Faq[];
}

export function Accordion({ items }: AccordionProps) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);
  const baseId = useId();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="divide-y divide-border border-t border-b border-border">
      {items.map((item) => {
        const isOpen = openId === item.id;
        const buttonId = `${baseId}-${item.id}-button`;
        const panelId = `${baseId}-${item.id}-panel`;

        return (
          <div key={item.id}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenId(isOpen ? null : item.id)}
                className="flex min-h-11 w-full items-center justify-between gap-4 py-5 text-left text-lg text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {item.question}
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-5 shrink-0 text-accent transition-transform duration-300",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.3,
                    ease: "easeOut",
                  }}
                  className="overflow-hidden"
                >
                  <p className="pb-5 pr-10 text-base text-muted">
                    {item.answer}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Verify**

Run (cwd = `pagina web/`):
```bash
npm run lint
npm run typecheck
```
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui
git commit -m "feat: add UI primitives (button, links, label, media card, accordion)"
```

---

### Task 5: Motion primitives and `AnimatedHeading`

**Files:**
- Create: `pagina web/src/components/motion/smooth-scroll-provider.tsx`
- Create: `pagina web/src/components/motion/reveal-text.tsx`
- Create: `pagina web/src/components/motion/parallax-media.tsx`
- Create: `pagina web/src/components/motion/horizontal-scroll.tsx`
- Create: `pagina web/src/components/ui/animated-heading.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils` (Task 3).
- Produces: `SmoothScrollProvider({ children })` from `@/components/motion/smooth-scroll-provider` (client component, wraps app in Lenis smooth scroll; no-ops under reduced motion).
- Produces: `RevealText({ lines: string[] })` from `@/components/motion/reveal-text` (client component, GSAP per-line reveal).
- Produces: `ParallaxMedia({ children, className? })` from `@/components/motion/parallax-media` (client component, GSAP scroll-linked scale).
- Produces: `HorizontalScroll({ children: React.ReactNode[], className? })` from `@/components/motion/horizontal-scroll` (client component, Embla-based draggable row with prev/next buttons).
- Produces: `AnimatedHeading({ lines: string[], as?: "h1" | "h2" | "h3", scale?: "hero" | "section" | "heading", className? })` from `@/components/ui/animated-heading`.

- [ ] **Step 1: Write `SmoothScrollProvider`**

Create `pagina web/src/components/motion/smooth-scroll-provider.tsx`:
```tsx
"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
    });

    lenis.on("scroll", ScrollTrigger.update);

    const tickerCallback = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tickerCallback);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
```

- [ ] **Step 2: Write `RevealText`**

Create `pagina web/src/components/motion/reveal-text.tsx`:
```tsx
"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface RevealTextProps {
  lines: string[];
}

export function RevealText({ lines }: RevealTextProps) {
  const rootRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const context = gsap.context(() => {
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      if (prefersReducedMotion) {
        gsap.set(".reveal-line-inner", { opacity: 1, y: 0 });
        return;
      }

      gsap.set(".reveal-line-inner", { opacity: 0, y: "100%" });
      gsap.to(".reveal-line-inner", {
        opacity: 1,
        y: "0%",
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top 85%",
          once: true,
        },
      });
    }, rootRef);

    return () => context.revert();
  }, []);

  return (
    <span ref={rootRef} className="block">
      {lines.map((line, index) => (
        <span key={index} className="block overflow-hidden">
          <span className="reveal-line-inner block">{line}</span>
        </span>
      ))}
    </span>
  );
}
```

- [ ] **Step 3: Write `ParallaxMedia`**

Create `pagina web/src/components/motion/parallax-media.tsx`:
```tsx
"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

interface ParallaxMediaProps {
  children: React.ReactNode;
  className?: string;
}

export function ParallaxMedia({ children, className }: ParallaxMediaProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        mediaRef.current,
        { scale: 1.12 },
        {
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: rootRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        }
      );
    }, rootRef);

    return () => context.revert();
  }, []);

  return (
    <div ref={rootRef} className={cn("overflow-hidden", className)}>
      <div ref={mediaRef} className="h-full w-full">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `HorizontalScroll`**

Create `pagina web/src/components/motion/horizontal-scroll.tsx`:
```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface HorizontalScrollProps {
  children: React.ReactNode[];
  className?: string;
}

export function HorizontalScroll({
  children,
  className,
}: HorizontalScrollProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    containScroll: "trimSnaps",
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateButtons = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const raf = requestAnimationFrame(updateButtons);
    emblaApi.on("select", updateButtons);
    emblaApi.on("reInit", updateButtons);
    return () => cancelAnimationFrame(raf);
  }, [emblaApi, updateButtons]);

  return (
    <div className={cn("relative", className)}>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-5">
          {children.map((child, index) => (
            <div
              key={index}
              className="min-w-0 shrink-0 grow-0 basis-[85%] sm:basis-[45%] lg:basis-[32%]"
            >
              {child}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          aria-label="Anterior"
          disabled={!canScrollPrev}
          onClick={() => emblaApi?.scrollPrev()}
          className="flex size-11 items-center justify-center rounded-pill border border-border text-text hover:border-accent hover:text-accent disabled:opacity-30"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Siguiente"
          disabled={!canScrollNext}
          onClick={() => emblaApi?.scrollNext()}
          className="flex size-11 items-center justify-center rounded-pill border border-border text-text hover:border-accent hover:text-accent disabled:opacity-30"
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `AnimatedHeading`**

Create `pagina web/src/components/ui/animated-heading.tsx`:
```tsx
import { RevealText } from "@/components/motion/reveal-text";
import { cn } from "@/lib/utils";

type HeadingTag = "h1" | "h2" | "h3";
type HeadingScale = "hero" | "section" | "heading";

interface AnimatedHeadingProps {
  lines: string[];
  as?: HeadingTag;
  scale?: HeadingScale;
  className?: string;
}

const scaleStyles: Record<HeadingScale, string> = {
  hero: "text-hero",
  section: "text-section",
  heading: "text-heading",
};

export function AnimatedHeading({
  lines,
  as: Tag = "h2",
  scale = "heading",
  className,
}: AnimatedHeadingProps) {
  return (
    <Tag
      className={cn(
        scaleStyles[scale],
        "font-display font-semibold leading-[1.05] text-text",
        className
      )}
    >
      <RevealText lines={lines} />
    </Tag>
  );
}
```

- [ ] **Step 6: Verify**

Run (cwd = `pagina web/`):
```bash
npm run lint
npm run typecheck
```
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/motion src/components/ui/animated-heading.tsx
git commit -m "feat: add GSAP/Lenis/Embla motion primitives and AnimatedHeading"
```

---

### Task 6: Layout — header, mobile menu, footer

**Files:**
- Create: `pagina web/src/components/layout/mobile-menu.tsx`
- Create: `pagina web/src/components/layout/header.tsx`
- Create: `pagina web/src/components/layout/footer.tsx`

**Interfaces:**
- Consumes: `Button` and `ExternalLink` from `@/components/ui/*` (Task 4); `siteConfig` from `@/content/site` (Task 3); `cn` from `@/lib/utils` (Task 3).
- Produces: `Header()` from `@/components/layout/header` (renders nav + `MobileMenu`, id-free, used once in root layout).
- Produces: `Footer()` from `@/components/layout/footer` (includes `id="contacto"`).
- Produces: `MobileMenu({ navLinks: { href: string; label: string }[], bookingHref: string })` from `@/components/layout/mobile-menu`.

- [ ] **Step 1: Write `MobileMenu`**

Create `pagina web/src/components/layout/mobile-menu.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileMenuProps {
  navLinks: { href: string; label: string }[];
  bookingHref: string;
}

export function MobileMenu({ navLinks, bookingHref }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="mobile-menu-panel"
        aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex size-11 items-center justify-center text-text"
      >
        {isOpen ? (
          <X aria-hidden="true" className="size-6" />
        ) : (
          <Menu aria-hidden="true" className="size-6" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="mobile-menu-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
            className="fixed inset-0 z-50 flex flex-col bg-bg px-6 py-5"
            onClick={() => setIsOpen(false)}
          >
            <div className="flex items-center justify-end">
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setIsOpen(false)}
                className="flex size-11 items-center justify-center text-text"
              >
                <X aria-hidden="true" className="size-6" />
              </button>
            </div>

            <nav
              aria-label="Navegación móvil"
              className="mt-10 flex flex-1 flex-col justify-center gap-6"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="text-3xl font-semibold text-text"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <Button
              href={bookingHref}
              external
              variant="primary"
              className="w-full justify-center"
            >
              Reserva tu primera sesión
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Write `Header`**

Create `pagina web/src/components/layout/header.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { siteConfig } from "@/content/site";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#modalidades", label: "Servicios" },
  { href: "#filosofia", label: "Método" },
  { href: "#equipo", label: "Equipo" },
  { href: "#contacto", label: "Contacto" },
];

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors duration-300",
        isScrolled
          ? "border-b border-border bg-bg/90 backdrop-blur"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-text"
        >
          {siteConfig.name}
        </Link>

        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-8 md:flex"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-text/80 transition-colors hover:text-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button
            href={siteConfig.harbizUrl}
            external
            variant="primary"
            className="text-sm"
          >
            Reserva tu primera sesión
          </Button>
        </div>

        <MobileMenu navLinks={navLinks} bookingHref={siteConfig.harbizUrl} />
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Write `Footer`**

Create `pagina web/src/components/layout/footer.tsx`:
```tsx
import { ExternalLink } from "@/components/ui/external-link";
import { siteConfig } from "@/content/site";

export function Footer() {
  return (
    <footer
      id="contacto"
      className="bg-bg-soft px-6 py-16 text-text lg:px-10 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <p className="text-section font-display font-semibold leading-[1.05]">
          {siteConfig.tagline}
        </p>

        <div className="mt-12 grid grid-cols-1 gap-10 border-t border-border pt-10 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Contacto
            </p>
            <p className="mt-3 text-sm text-text/80">{siteConfig.address}</p>
            <p className="mt-1 text-sm text-text/80">{siteConfig.phone}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Horario
            </p>
            <p className="mt-3 text-sm text-text/80">{siteConfig.hours}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Síguenos
            </p>
            <p className="mt-3 text-sm">
              <ExternalLink
                href={siteConfig.instagramUrl}
                className="text-text/80 hover:text-accent"
              >
                Instagram
              </ExternalLink>
            </p>
            <p className="mt-3 text-sm">
              <ExternalLink
                href={siteConfig.harbizUrl}
                className="text-text/80 hover:text-accent"
              >
                Reservar en Harbiz
              </ExternalLink>
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. Todos los
            derechos reservados.
          </p>
          <p>Aviso legal, privacidad y cookies — próximamente.</p>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Verify**

Run (cwd = `pagina web/`):
```bash
npm run lint
npm run typecheck
```
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout
git commit -m "feat: add header, mobile menu, and footer"
```

---

### Task 7: Hero and Philosophy sections

**Files:**
- Create: `pagina web/src/components/sections/hero.tsx`
- Create: `pagina web/src/components/sections/philosophy.tsx`

**Interfaces:**
- Consumes: `AnimatedHeading` (Task 5), `Button`, `MediaCard` (Task 4), `ParallaxMedia` (Task 5), `siteConfig` (Task 3).
- Produces: `Hero()` from `@/components/sections/hero`.
- Produces: `Philosophy()` from `@/components/sections/philosophy` (renders `id="filosofia"`).

- [ ] **Step 1: Write `Hero`**

Create `pagina web/src/components/sections/hero.tsx`:
```tsx
import { AnimatedHeading } from "@/components/ui/animated-heading";
import { Button } from "@/components/ui/button";
import { MediaCard } from "@/components/ui/media-card";
import { siteConfig } from "@/content/site";

export function Hero() {
  return (
    <section className="relative flex min-h-[90vh] flex-col justify-end gap-10 overflow-hidden px-6 pb-16 pt-32 lg:px-10 lg:pb-24">
      <div className="absolute inset-0 -z-10">
        <MediaCard
          label="Vídeo o foto de portada pendiente"
          aspect="landscape"
          className="h-full w-full rounded-none border-none"
        />
      </div>

      <div className="max-w-3xl">
        <AnimatedHeading
          as="h1"
          scale="hero"
          lines={["ENTRENA PARA", "VIVIR MEJOR."]}
          className="text-white"
        />

        <p className="mt-6 max-w-xl text-body-large text-white/85">
          Entrenamiento personal y en grupos reducidos, adaptado a tu nivel,
          tu cuerpo y tus objetivos.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Button href={siteConfig.harbizUrl} external variant="primary">
            Reserva tu primera sesión
          </Button>
          <Button
            href="#filosofia"
            variant="secondary"
            className="border-white/40 text-white hover:border-accent hover:text-accent"
          >
            Conoce Elefitness
          </Button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `Philosophy`**

Create `pagina web/src/components/sections/philosophy.tsx`:
```tsx
import { AnimatedHeading } from "@/components/ui/animated-heading";
import { SectionLabel } from "@/components/ui/section-label";
import { MediaCard } from "@/components/ui/media-card";
import { ParallaxMedia } from "@/components/motion/parallax-media";

export function Philosophy() {
  return (
    <section id="filosofia" className="px-6 py-20 lg:px-10 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
        <div>
          <SectionLabel>Nuestra filosofía</SectionLabel>
          <AnimatedHeading
            as="h2"
            scale="section"
            lines={["NO SE TRATA DE HACER MÁS.", "SE TRATA DE HACERLO MEJOR."]}
            className="mt-4"
          />
          <p className="mt-6 max-w-md text-body-large text-muted">
            Diseñamos cada entrenamiento para que avances de forma segura,
            progresiva y sostenible, con seguimiento real en cada sesión.
          </p>
        </div>

        <ParallaxMedia className="rounded-lg">
          <MediaCard
            label="Foto del centro pendiente"
            aspect="portrait"
            className="h-full w-full rounded-lg"
          />
        </ParallaxMedia>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify**

Run (cwd = `pagina web/`):
```bash
npm run lint
npm run typecheck
```
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/hero.tsx src/components/sections/philosophy.tsx
git commit -m "feat: add Hero and Philosophy sections"
```

---

### Task 8: Services and Training Experience sections

**Files:**
- Create: `pagina web/src/components/sections/services.tsx`
- Create: `pagina web/src/components/sections/training-experience.tsx`

**Interfaces:**
- Consumes: `AnimatedHeading`, `SectionLabel`, `Button`, `MediaCard` (Tasks 4-5); `services` from `@/content/services` (Task 3).
- Produces: `Services()` from `@/components/sections/services` (renders `id="modalidades"`).
- Produces: `TrainingExperience()` from `@/components/sections/training-experience`.

- [ ] **Step 1: Write `Services`**

Create `pagina web/src/components/sections/services.tsx`:
```tsx
import { AnimatedHeading } from "@/components/ui/animated-heading";
import { SectionLabel } from "@/components/ui/section-label";
import { Button } from "@/components/ui/button";
import { MediaCard } from "@/components/ui/media-card";
import { services } from "@/content/services";

export function Services() {
  return (
    <section id="modalidades" className="px-6 py-20 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionLabel>Modalidades</SectionLabel>
        <AnimatedHeading
          as="h2"
          scale="section"
          lines={["ENCUENTRA TU", "FORMA DE ENTRENAR."]}
          className="mt-4 max-w-2xl"
        />

        <div className="mt-16 flex flex-col divide-y divide-border border-t border-b border-border">
          {services.map((service) => (
            <article
              key={service.id}
              className="grid gap-6 py-10 lg:grid-cols-[auto_1fr_1fr] lg:items-center lg:gap-12"
            >
              <span className="text-xl font-display text-accent">
                {service.number}
              </span>

              <div>
                <h3 className="text-heading font-display font-semibold leading-tight text-text">
                  {service.name}
                </h3>
                <p className="mt-3 max-w-md text-base text-muted">
                  {service.description}
                </p>
                <p className="mt-4 text-sm text-accent">{service.benefit}</p>
                <p className="mt-1 text-sm text-muted">{service.audience}</p>
              </div>

              <div className="flex flex-col items-start gap-4 lg:items-end">
                <MediaCard
                  label="Foto pendiente"
                  aspect="landscape"
                  className="w-full lg:w-64"
                />
                <Button href="#contacto" variant="secondary" className="text-sm">
                  Descubrir modalidad
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `TrainingExperience`**

Create `pagina web/src/components/sections/training-experience.tsx`:
```tsx
import { AnimatedHeading } from "@/components/ui/animated-heading";
import { SectionLabel } from "@/components/ui/section-label";
import { MediaCard } from "@/components/ui/media-card";

const galleryLabels = [
  "Foto del espacio pendiente",
  "Foto de entrenamiento pendiente",
  "Foto de grupo pendiente",
  "Foto de detalle pendiente",
];

export function TrainingExperience() {
  return (
    <section className="px-6 py-20 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionLabel>El centro</SectionLabel>
        <AnimatedHeading
          as="h2"
          scale="section"
          lines={["UN ESPACIO PENSADO", "PARA ENTRENAR BIEN."]}
          className="mt-4 max-w-2xl"
        />

        <div className="mt-16 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {galleryLabels.map((label, index) => (
            <MediaCard
              key={label}
              label={label}
              aspect={index % 2 === 0 ? "portrait" : "square"}
              className="w-full"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify**

Run (cwd = `pagina web/`):
```bash
npm run lint
npm run typecheck
```
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/services.tsx src/components/sections/training-experience.tsx
git commit -m "feat: add Services and Training Experience sections"
```

---

### Task 9: Community and Testimonials sections

**Files:**
- Create: `pagina web/src/components/sections/community.tsx`
- Create: `pagina web/src/components/sections/testimonials.tsx`

**Interfaces:**
- Consumes: `AnimatedHeading`, `SectionLabel`, `MediaCard` (Tasks 4-5); `HorizontalScroll` (Task 5); `testimonials` from `@/content/testimonials` (Task 3).
- Produces: `Community()` from `@/components/sections/community`.
- Produces: `Testimonials()` from `@/components/sections/testimonials`.

- [ ] **Step 1: Write `Community`**

Create `pagina web/src/components/sections/community.tsx`:
```tsx
import { AnimatedHeading } from "@/components/ui/animated-heading";
import { SectionLabel } from "@/components/ui/section-label";
import { MediaCard } from "@/components/ui/media-card";
import { HorizontalScroll } from "@/components/motion/horizontal-scroll";

const communityMoments = [
  "Foto de actividad grupal pendiente",
  "Foto de evento pendiente",
  "Foto de sesión especial pendiente",
  "Foto de comunidad pendiente",
  "Foto de carrera pendiente",
];

export function Community() {
  return (
    <section className="bg-bg-soft px-6 py-20 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionLabel>Comunidad</SectionLabel>
        <AnimatedHeading
          as="h2"
          scale="section"
          lines={["ENTRENAR EN BUENA", "COMPAÑÍA."]}
          className="mt-4 max-w-2xl"
        />

        <div className="mt-16">
          <HorizontalScroll>
            {communityMoments.map((label) => (
              <MediaCard key={label} label={label} aspect="portrait" className="w-full" />
            ))}
          </HorizontalScroll>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `Testimonials`**

Create `pagina web/src/components/sections/testimonials.tsx`:
```tsx
import { AnimatedHeading } from "@/components/ui/animated-heading";
import { SectionLabel } from "@/components/ui/section-label";
import { testimonials } from "@/content/testimonials";

export function Testimonials() {
  const [featured, ...rest] = testimonials;

  return (
    <section className="bg-surface-light px-6 py-20 text-text-dark lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionLabel className="text-accent-dark">Testimonios</SectionLabel>
        <AnimatedHeading
          as="h2"
          scale="section"
          lines={["LO QUE CUENTAN", "QUIENES ENTRENAN CON NOSOTROS."]}
          className="mt-4 max-w-2xl text-text-dark"
        />

        {featured && (
          <blockquote className="mt-16 max-w-3xl">
            {featured.isPlaceholder && (
              <p className="mb-3 text-xs uppercase tracking-[0.2em] text-accent-dark">
                Contenido de ejemplo
              </p>
            )}
            <p className="text-body-large text-text-dark">
              &ldquo;{featured.quote}&rdquo;
            </p>
            <footer className="mt-4 text-sm text-text-dark/70">
              {featured.name} — {featured.timeTraining}
            </footer>
          </blockquote>
        )}

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((testimonial) => (
            <blockquote
              key={testimonial.id}
              className="rounded-lg border border-text-dark/10 p-6"
            >
              {testimonial.isPlaceholder && (
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-accent-dark">
                  Contenido de ejemplo
                </p>
              )}
              <p className="text-sm text-text-dark">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <footer className="mt-4 text-xs text-text-dark/70">
                {testimonial.name} — {testimonial.timeTraining}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify**

Run (cwd = `pagina web/`):
```bash
npm run lint
npm run typecheck
```
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/community.tsx src/components/sections/testimonials.tsx
git commit -m "feat: add Community and Testimonials sections"
```

---

### Task 10: Team and FAQ sections

**Files:**
- Create: `pagina web/src/components/sections/team.tsx`
- Create: `pagina web/src/components/sections/faq.tsx`

**Interfaces:**
- Consumes: `AnimatedHeading`, `SectionLabel`, `MediaCard`, `Accordion` (Tasks 4-5); `team` from `@/content/team`, `faqs` from `@/content/faqs` (Task 3).
- Produces: `Team()` from `@/components/sections/team` (renders `id="equipo"`).
- Produces: `Faq()` from `@/components/sections/faq`.

- [ ] **Step 1: Write `Team`**

Create `pagina web/src/components/sections/team.tsx`:
```tsx
import { AnimatedHeading } from "@/components/ui/animated-heading";
import { SectionLabel } from "@/components/ui/section-label";
import { MediaCard } from "@/components/ui/media-card";
import { team } from "@/content/team";

export function Team() {
  return (
    <section id="equipo" className="px-6 py-20 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionLabel>Equipo</SectionLabel>
        <AnimatedHeading
          as="h2"
          scale="section"
          lines={["LAS PERSONAS DETRÁS", "DE ELEFITNESS."]}
          className="mt-4 max-w-2xl"
        />

        <div className="mt-16 grid gap-10 sm:grid-cols-2">
          {team.map((member) => (
            <div key={member.id}>
              <MediaCard label="Foto pendiente" aspect="portrait" className="w-full" />
              <h3 className="mt-5 text-xl font-display font-semibold text-text">
                {member.name}
              </h3>
              <p className="mt-1 text-sm text-accent">{member.role}</p>
              <p className="mt-3 max-w-sm text-sm text-muted">{member.bio}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `Faq`**

Create `pagina web/src/components/sections/faq.tsx`:
```tsx
import { AnimatedHeading } from "@/components/ui/animated-heading";
import { SectionLabel } from "@/components/ui/section-label";
import { Accordion } from "@/components/ui/accordion";
import { faqs } from "@/content/faqs";

export function Faq() {
  return (
    <section className="px-6 py-20 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-3xl">
        <SectionLabel>Preguntas frecuentes</SectionLabel>
        <AnimatedHeading
          as="h2"
          scale="section"
          lines={["RESOLVEMOS TUS", "DUDAS."]}
          className="mt-4"
        />

        <div className="mt-12">
          <Accordion items={faqs} />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify**

Run (cwd = `pagina web/`):
```bash
npm run lint
npm run typecheck
```
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/team.tsx src/components/sections/faq.tsx
git commit -m "feat: add Team and FAQ sections"
```

---

### Task 11: Final CTA section

**Files:**
- Create: `pagina web/src/components/sections/final-cta.tsx`

**Interfaces:**
- Consumes: `AnimatedHeading`, `Button` (Tasks 4-5); `siteConfig` from `@/content/site` (Task 3).
- Produces: `FinalCta()` from `@/components/sections/final-cta`.

- [ ] **Step 1: Write `FinalCta`**

Create `pagina web/src/components/sections/final-cta.tsx`:
```tsx
import { AnimatedHeading } from "@/components/ui/animated-heading";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/content/site";

export function FinalCta() {
  return (
    <section className="bg-bg-soft px-6 py-24 text-center lg:px-10 lg:py-32">
      <div className="mx-auto max-w-3xl">
        <AnimatedHeading
          as="h2"
          scale="section"
          lines={["EMPIEZA A ENTRENAR", "CUANDO QUIERAS."]}
          className="justify-center"
        />

        <p className="mt-6 text-body-large text-muted">
          Sin experiencia previa, sin excusas de horario: reserva tu primera
          sesión y empieza desde tu nivel.
        </p>

        <div className="mt-8 flex justify-center">
          <Button href={siteConfig.harbizUrl} external variant="primary">
            Reserva tu primera sesión
          </Button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

Run (cwd = `pagina web/`):
```bash
npm run lint
npm run typecheck
```
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/final-cta.tsx
git commit -m "feat: add Final CTA section"
```

---

### Task 12: Assemble root layout and Home page

**Files:**
- Modify: `pagina web/src/app/layout.tsx`
- Modify: `pagina web/src/app/page.tsx`

**Interfaces:**
- Consumes: `Header`, `Footer` (Task 6); `SmoothScrollProvider` (Task 5); `Hero`, `Philosophy`, `Services`, `TrainingExperience`, `Community`, `Testimonials`, `Team`, `Faq`, `FinalCta` (Tasks 7-11).
- Produces: the assembled `/` route rendering the full Home page in the order defined by `pagina web/CLAUDE.md` section 11.1.

- [ ] **Step 1: Replace `layout.tsx`**

Replace the full contents of `pagina web/src/app/layout.tsx` with:
```tsx
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SmoothScrollProvider } from "@/components/motion/smooth-scroll-provider";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Elefitness — Entrenamiento personal en Valencia",
  description:
    "Entrenamiento personal y en grupos reducidos en Valencia, adaptado a tu nivel, tu cuerpo y tus objetivos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={manrope.variable}>
      <body className="bg-bg font-body text-text antialiased">
        <SmoothScrollProvider>
          <Header />
          <main>{children}</main>
          <Footer />
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Replace `page.tsx`**

Replace the full contents of `pagina web/src/app/page.tsx` with:
```tsx
import { Hero } from "@/components/sections/hero";
import { Philosophy } from "@/components/sections/philosophy";
import { Services } from "@/components/sections/services";
import { TrainingExperience } from "@/components/sections/training-experience";
import { Community } from "@/components/sections/community";
import { Testimonials } from "@/components/sections/testimonials";
import { Team } from "@/components/sections/team";
import { Faq } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";

export default function Home() {
  return (
    <>
      <Hero />
      <Philosophy />
      <Services />
      <TrainingExperience />
      <Community />
      <Testimonials />
      <Team />
      <Faq />
      <FinalCta />
    </>
  );
}
```

- [ ] **Step 3: Verify**

Run (cwd = `pagina web/`):
```bash
npm run lint
npm run typecheck
npm run build
```
Expected: all three exit 0; `next build` reports the `/` route as prerendered with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx
git commit -m "feat: assemble Home page from all sections"
```

---

### Task 13: Full verification pass

**Files:** none created or modified — this task only verifies.

**Interfaces:** none produced.

- [ ] **Step 1: Start the dev server**

Run (cwd = `pagina web/`), in the background:
```bash
npm run dev
```
Expected: server starts on `http://localhost:3000` with no console errors.

- [ ] **Step 2: Visual check — desktop**

Open `http://localhost:3000` in a browser at a desktop width (≥1280px). Confirm: all 9 sections render in order (Hero → Philosophy → Services → Training Experience → Community → Testimonials → Team → FAQ → Final CTA) plus Header and Footer; no layout shift or overlap; placeholder `MediaCard` blocks are clearly labeled, never blank.

- [ ] **Step 3: Visual check — mobile (375px) and 320px**

Resize to 375px and then 320px width. Confirm: no horizontal scroll, no text overflow or orphaned single-word headings, header collapses to the hamburger menu, all CTAs remain visible and reachable, touch targets look at least 44×44px.

- [ ] **Step 4: Visual check — tablet (768px)**

Resize to 768px. Confirm layout adapts cleanly between mobile and desktop breakpoints (grids reflow, no cramped or excessively empty sections).

- [ ] **Step 5: Keyboard navigation check**

Using only Tab/Shift+Tab/Enter/Escape: open the mobile menu (narrow the viewport first), confirm focus moves into the panel, Escape closes it and returns focus sensibly. Tab through the FAQ accordion, confirm each question is reachable and togglable with Enter/Space, and `aria-expanded` toggles correctly (inspect via browser dev tools or accessibility tree).

- [ ] **Step 6: Reduced motion check**

Enable "prefers reduced motion" (OS-level or via browser dev tools rendering emulation), reload the page. Confirm: headings appear immediately without the line-reveal animation, no Lenis smooth-scroll easing (native scroll instead), the philosophy image doesn't parallax, transitions are effectively instant. Confirm the page is still fully usable.

- [ ] **Step 7: External link check**

Inspect the "Reserva tu primera sesión" (header, hero, mobile menu, final CTA) and footer "Instagram"/"Reservar en Harbiz" links. Confirm each opens in a new tab (`target="_blank"`) and has `rel="noopener noreferrer"`.

- [ ] **Step 8: Stop the dev server**

Stop the background `npm run dev` process.

- [ ] **Step 9: Final commit (only if Steps 2-7 required fixes)**

If any check above required a code fix, stage and commit it with a message describing what was fixed, e.g.:
```bash
git add -A
git commit -m "fix: address responsive/accessibility issues found in Home v1 QA pass"
```
If no fixes were needed, skip this step — there is nothing to commit.
