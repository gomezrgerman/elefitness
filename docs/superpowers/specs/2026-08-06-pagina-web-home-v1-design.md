# Elefitness — Página web pública, Home v1 (diseño)

## Contexto

Este spec cubre la **primera versión de la web pública/marketing de Elefitness**, distinta del sistema de reservas y pagos (el `app/` en la raíz del repo, con Supabase). Vive en la carpeta `pagina web/` como proyecto Next.js independiente, con su propio `package.json`.

La fuente de verdad para reglas visuales, de contenido y técnicas es `pagina web/CLAUDE.md` (documento de 42 secciones ya validado como base de diseño). Este spec traduce ese documento en un alcance concreto y accionable para la primera entrega: **solo la página de inicio (Home)**, no el resto del árbol de páginas.

## Alcance

### Dentro de esta v1

- Proyecto Next.js 15 (App Router) + React + TypeScript estricto + Tailwind, scaffolded en `pagina web/`.
- Una sola ruta funcional: `/` (Home), con Header y Footer.
- Todas las secciones de la Home listadas en la sección 11.1 del CLAUDE.md, en el orden ahí indicado.
- Sistema de diseño (color, tipografía, espaciado, radios) tomado literalmente de las secciones 5-8 del CLAUDE.md.
- Stack de animación completo desde el inicio: GSAP + ScrollTrigger + Lenis + Framer Motion (solo para menú móvil), según sección 23.
- Contenido con placeholders visibles y honestos donde no hay datos reales todavía (fotos, testimonios, tarifas, horarios, enlace de Harbiz).

### Fuera de esta v1 (deliberadamente pospuesto)

- Páginas `/servicios`, `/equipo`, `/actividades`, `/contacto`, `/aviso-legal`, `/privacidad`, `/cookies` — no se crean todavía. El header/footer no deben apuntar a rutas inexistentes; en su lugar usan anclas dentro de la propia Home (p.ej. `#modalidades`, `#equipo`) hasta que esas páginas existan.
- Analítica (sección 32), formularios (sección 33) y datos estructurados/schema (sección 31.3) — se añaden cuando haya página de contacto y contenido real que respalde el schema.
- Integración real con Harbiz — el CTA usa `href="#"` (o el placeholder que se defina) hasta tener el enlace real.

## Decisiones de diseño

### A. Setup del proyecto

- Next.js 15 App Router, TypeScript estricto (sin `any`), Tailwind CSS.
- `pagina web/` es un proyecto Next.js autocontenido: su propio `package.json`, `src/` (o `app/` en la raíz del proyecto, según lo que genere `create-next-app`), sin dependencias cruzadas con el `app/` del sistema de reservas en la raíz del repo.
- Fuente Manrope Variable vía `next/font/google`.
- Estructura de carpetas según sección 24 del CLAUDE.md:
  ```
  app/ (o src/app/)
  components/{layout,sections,ui,motion}/
  content/
  lib/
  styles/
  types/
  ```

### B. Secciones de la Home (orden fijo, sección 11.1)

1. Header — sticky, transparente al inicio y sólido al hacer scroll; menú móvil a pantalla completa con Framer Motion.
2. Hero — titular grande (copy provisional de la sección 12.3), CTA primario "Reserva tu primera sesión" (→ placeholder Harbiz), CTA secundario "Conoce Elefitness" (→ ancla).
3. Propuesta de valor / Filosofía — etiqueta + titular + párrafo + imagen placeholder (sección 14).
4. Modalidades de entrenamiento — paneles editoriales numerados, no grid de tarjetas (sección 13): personal, grupos reducidos, fuerza, +50, yoga, GAP, bailoterapia, body combat.
5. Experiencia visual del centro — mosaico/galería con imágenes placeholder.
6. Comunidad — scroll horizontal arrastrable con tarjetas superpuestas (sección 15).
7. Testimonios — una reseña grande + secundarias; placeholders explícitamente marcados como contenido de ejemplo, nunca presentados como reseñas reales (sección 16.3).
8. Equipo — Elena (dueña/admin) e Ivan (entrenador), con foto/frase/certificaciones como placeholder pero nombre y rol reales.
9. FAQ — acordeón accesible (teclado, `aria-expanded`, `aria-controls`) con las preguntas de la sección 18.
10. CTA final.
11. Footer — dirección/teléfono/Instagram/horario/Harbiz como placeholders; enlaces a páginas legales aún no creadas quedan deshabilitados o marcados "próximamente" en vez de enlazar a rutas rotas.

### C. Contenido y datos

Archivos en `content/`:

- `site.ts` — datos de marca: nombre, dirección, teléfono, Instagram, horario, link Harbiz (todos placeholder salvo lo ya confirmado).
- `services.ts` — las 8 modalidades de la sección 13.
- `testimonials.ts` — 2-3 testimonios placeholder, comentados en código como contenido de ejemplo pendiente de sustitución.
- `team.ts` — Elena e Ivan con nombre/rol reales, resto placeholder.
- `faqs.ts` — preguntas de la sección 18 con respuestas breves y honestas (incluida la de Harbiz, explicando que las reservas se gestionan ahí).

Regla dura (sección 37 del CLAUDE.md): no inventar datos como si fueran reales. Todo placeholder debe ser visualmente identificable como tal (texto "Foto pendiente", fondo con patrón neutro, o etiqueta pequeña "contenido de ejemplo").

### D. Tokens de diseño

Los tokens de color (sección 5), tipografía (sección 6), espaciado (sección 7) y radios (sección 8) del CLAUDE.md se trasladan literalmente a la configuración de Tailwind / CSS variables en `styles/globals.css`. No se introducen valores fuera de esa escala.

### E. Animación

- `motion/smooth-scroll-provider.tsx` — envuelve la app con Lenis; respeta `prefers-reduced-motion`.
- `motion/reveal-text.tsx` — revelado de titulares por líneas (GSAP + ScrollTrigger).
- `motion/parallax-media.tsx` — parallax/zoom ligero en imágenes de hero y filosofía.
- `motion/horizontal-scroll.tsx` — para la sección de comunidad.
- Menú móvil animado con Framer Motion (entrada/salida del panel full-screen) — único uso de Framer Motion, sin mezclarlo con GSAP en el mismo elemento (regla sección 23.3).
- Limpieza obligatoria de animaciones GSAP vía `gsap.context()` + `context.revert()` al desmontar.
- Bloque `@media (prefers-reduced-motion: reduce)` global (sección 22.4); la experiencia debe seguir siendo funcional sin animaciones.

### F. Verificación antes de cerrar la v1

Siguiendo la sección 38 del CLAUDE.md:

- Lint y typecheck tras cambios relevantes.
- Revisión responsive desde 320px, tablet y desktop.
- Navegación por teclado en acordeón FAQ y menú móvil (focus visible, `aria-expanded`, `aria-controls`).
- Comprobación de `reduced-motion`.
- Arranque real del dev server y verificación visual en navegador antes de dar la tarea por completa.
- Enlaces externos (Harbiz, Instagram) con `rel="noopener noreferrer"` cuando abran en nueva pestaña.

## Criterios de aceptación (derivados de sección 39 del CLAUDE.md)

La Home v1 se considera correcta cuando:

- Respeta la paleta y tokens definidos, sin colores ajenos.
- Mantiene la jerarquía tipográfica (títulos grandes, cuerpo contenido).
- No parece una plantilla genérica de gimnasio (sin grid de 3 tarjetas, sin neones, sin degradados tecnológicos).
- Todo contenido de ejemplo está claramente identificado como placeholder.
- Funciona correctamente en móvil, tablet y desktop.
- Funciona (sin romperse) con animaciones desactivadas.
- Los CTA son claros y no hay más de dos CTA principales por sección.
- El acordeón FAQ y el menú móvil son accesibles por teclado.

## Preguntas abiertas (no bloquean esta v1, pendientes para iteraciones siguientes)

- Enlace real de Harbiz, dirección exacta, teléfono, horario — pendientes del cliente (sección 37 del CLAUDE.md).
- Fotografías y vídeos reales del centro — sustituirán los placeholders cuando estén disponibles.
- Testimonios reales con autorización — sustituirán los placeholders.
- Cuándo se construyen las páginas restantes del árbol (`/servicios`, `/equipo`, etc.) — a decidir tras validar la Home con la clienta.
