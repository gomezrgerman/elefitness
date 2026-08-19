# CLAUDE.md — Elefitness Website

## 1. Propósito del documento

Este archivo define las reglas visuales, técnicas y de contenido que deben seguirse durante el desarrollo de la web de **Elefitness**.

Debe utilizarse como referencia permanente para:

- Diseñar nuevas secciones.
- Crear componentes.
- Escribir textos.
- Implementar animaciones.
- Mantener coherencia visual.
- Evitar decisiones genéricas o improvisadas.
- Conservar la identidad de Elefitness.
- Mantener una experiencia inspirada en la dirección artística de six2eight.com, sin copiar literalmente sus textos, imágenes, código, marca ni componentes propietarios.

La web debe parecer una experiencia digital premium, editorial y dinámica. No debe parecer una plantilla convencional de gimnasio.

---

# 2. Contexto de marca

## 2.1 Nombre

**Elefitness**

## 2.2 Tipo de negocio

Centro de entrenamiento personal ubicado en Valencia.

## 2.3 Posicionamiento percibido

Elefitness no debe presentarse como:

- Gimnasio masificado.
- Box de CrossFit.
- Centro de culturismo.
- Marca centrada únicamente en estética.
- Espacio para atletas de alto rendimiento.
- Negocio basado en cuerpos perfectos o postureo.

Elefitness debe presentarse como:

- Centro cercano.
- Espacio profesional.
- Entrenamiento adaptado.
- Comunidad reducida.
- Lugar seguro para personas con distintos niveles.
- Centro orientado a salud, fuerza y bienestar.
- Entorno motivador y humano.
- Servicio con seguimiento real.

## 2.4 Personalidad

La personalidad de la marca debe transmitir:

- Cercanía.
- Profesionalidad.
- Seguridad.
- Energía controlada.
- Confianza.
- Salud.
- Evolución.
- Comunidad.
- Movimiento.
- Atención personalizada.

## 2.5 Idea central de marca

> Entrenar para vivir mejor.

Esta frase funciona como concepto estratégico. Puede adaptarse, pero la web siempre debe priorizar la mejora de la vida diaria por encima de la estética.

## 2.6 Público objetivo

La comunicación debe resultar comprensible y atractiva para:

- Personas que quieren empezar a entrenar.
- Personas que se sienten incómodas en gimnasios comerciales.
- Personas que necesitan seguimiento.
- Mujeres adultas.
- Personas de más de 50 años.
- Personas con poca experiencia.
- Personas que desean perder grasa.
- Personas que quieren ganar fuerza.
- Personas que buscan mejorar movilidad.
- Personas con molestias o limitaciones que requieran adaptación.
- Usuarios que valoran un entorno cercano.
- Personas interesadas en yoga, actividades dirigidas y comunidad.

No asumir que el visitante conoce terminología técnica de entrenamiento.

---

# 3. Referencia visual principal

La referencia de dirección artística es:

- https://six2eight.com/

La referencia se utiliza para estudiar:

- Escala tipográfica.
- Ritmo visual.
- Composiciones asimétricas.
- Uso de bloques amplios.
- Navegación minimalista.
- Movimiento suave.
- Secciones editoriales.
- Paneles visuales.
- Transiciones.
- Jerarquía.
- Uso del espacio negativo.
- Relación entre texto, imágenes y vídeo.

## 3.1 Regla de originalidad

No copiar:

- Textos.
- Imágenes.
- Logotipos.
- Identidad.
- Nombres.
- Código propietario.
- Estructuras exactas.
- Componentes idénticos.
- Iconografía exclusiva.
- Animaciones reproducidas de forma literal.

Sí se puede reinterpretar:

- Escala.
- Ritmo.
- Jerarquía.
- Sensación editorial.
- Uso de paneles.
- Movimiento.
- Espaciado.
- Diseño inmersivo.
- Composición.
- Forma de presentar contenidos.

El resultado debe ser reconocible como una web propia de Elefitness.

---

# 4. Dirección visual

## 4.1 Objetivo visual

La web debe sentirse:

- Moderna.
- Premium.
- Humana.
- Editorial.
- Minimalista.
- Activa.
- Profesional.
- Diferente a una plantilla de gimnasio.

## 4.2 Evitar

No utilizar:

- Neones.
- Fondos de gimnasio industrial genérico.
- Rojo agresivo.
- Negro puro en toda la web.
- Degradados tecnológicos.
- Tarjetas genéricas en cuadrícula de tres columnas.
- Efectos 3D gratuitos.
- Exceso de sombras.
- Iconos decorativos sin función.
- Imágenes de stock cuando haya fotografías reales.
- Tipografías deportivas agresivas.
- Contornos metálicos.
- Texturas de carbono.
- Rayos, llamas o efectos de alta intensidad.
- Frases de culturismo.
- Lenguaje de culpa.
- Promesas rápidas.
- Mensajes basados en vergüenza corporal.

## 4.3 Sensación de interfaz

La interfaz debe combinar:

- Fondos oscuros.
- Superficies claras.
- Imágenes grandes.
- Texto de gran formato.
- Espaciado generoso.
- Bordes suaves.
- Secciones amplias.
- Elementos que se deslizan o se apilan.
- Movimiento controlado.
- Botones claros.
- Navegación simple.

---

# 5. Sistema de color

Los colores exactos deben ajustarse cuando se disponga del logotipo original en alta resolución.

Usar inicialmente estos tokens:

```css
:root {
  --color-bg: #171918;
  --color-bg-soft: #232625;
  --color-surface: #2D3130;
  --color-surface-light: #F1F1ED;
  --color-white: #F8F8F4;
  --color-text: #F4F4EF;
  --color-text-dark: #161817;
  --color-muted: #A7ADAA;
  --color-border: rgba(255, 255, 255, 0.14);
  --color-accent: #78A8A2;
  --color-accent-soft: #A9C7C2;
  --color-accent-dark: #527D78;
}
```

## 5.1 Reglas de uso

- El turquesa debe funcionar como acento, no como fondo dominante.
- El blanco debe ser ligeramente cálido.
- Evitar contrastes demasiado duros.
- Usar superficies claras para romper el ritmo oscuro.
- Los textos secundarios deben mantener contraste accesible.
- El color de acento se reservará para:
  - CTA.
  - Indicadores.
  - Enlaces.
  - Etiquetas.
  - Estados activos.
  - Detalles gráficos.
- No utilizar más de un color de acento principal.

---

# 6. Tipografía

## 6.1 Tipografía recomendada

Primera opción:

- **Manrope Variable**

Alternativas:

- Inter.
- DM Sans.
- Plus Jakarta Sans.

No utilizar fuentes sin licencia válida.

## 6.2 Jerarquía

```css
:root {
  --font-display: "Manrope", sans-serif;
  --font-body: "Manrope", sans-serif;

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
}
```

## 6.3 Reglas tipográficas

- Titulares con pocas palabras.
- Frases directas.
- Interlineado compacto en títulos.
- Interlineado amplio en cuerpo.
- No justificar párrafos.
- Limitar el ancho de lectura.
- Evitar bloques de texto muy largos.
- No usar mayúsculas en párrafos.
- Las mayúsculas pueden utilizarse en etiquetas pequeñas.
- Mantener contraste entre títulos enormes y textos contenidos.
- No utilizar más de dos familias tipográficas.

---

# 7. Sistema de espaciado

Utilizar una escala consistente:

```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 3rem;
  --space-8: 4rem;
  --space-9: 6rem;
  --space-10: 8rem;
  --space-11: 12rem;
}
```

Reglas:

- Las secciones deben respirar.
- Evitar agrupar demasiada información.
- En escritorio, usar separaciones verticales amplias.
- En móvil, reducir el espaciado sin perder jerarquía.
- No añadir márgenes arbitrarios fuera de la escala.

---

# 8. Bordes y formas

```css
:root {
  --radius-sm: 0.75rem;
  --radius-md: 1.25rem;
  --radius-lg: 2rem;
  --radius-xl: 3rem;
  --radius-pill: 999px;
}
```

Reglas:

- Usar radios amplios en paneles visuales.
- No redondear absolutamente todos los elementos.
- Los botones principales pueden usar forma pill.
- Las imágenes editoriales pueden combinar esquinas rectas y redondeadas.
- Evitar sombras profundas.
- Priorizar contraste de superficie y borde.

---

# 9. Fotografía y vídeo

## 9.1 Estilo visual del contenido

Las imágenes deben mostrar:

- Personas reales.
- Entrenadores reales.
- Clientes reales.
- Entrenamientos reales.
- Grupos.
- Movimiento.
- Espacios del centro.
- Actividades.
- Comunidad.
- Diversidad de edades.
- Situaciones naturales.

## 9.2 Tratamiento

- Buena iluminación.
- Colores neutros.
- Saturación moderada.
- No aplicar filtros agresivos.
- Evitar poses artificiales.
- Evitar cuerpos recortados sin contexto.
- Priorizar encuadres humanos.
- Utilizar vídeo corto para hero o secciones inmersivas cuando sea viable.
- Todos los vídeos deben tener `poster`.
- Todos los vídeos deben ofrecer alternativa visual.
- No reproducir audio automáticamente.

## 9.3 Formatos

- AVIF como primera opción.
- WebP como alternativa.
- MP4 o WebM optimizado para vídeo.
- Lazy loading por debajo del primer viewport.
- Dimensiones definidas para evitar CLS.

---

# 10. Tono de voz

## 10.1 Características

Los textos deben ser:

- Claros.
- Cercanos.
- Profesionales.
- Humanos.
- Positivos.
- Directos.
- Comprensibles.
- Sin exageraciones.

## 10.2 Evitar frases como

- “Transforma tu cuerpo en 30 días”.
- “No hay excusas”.
- “Sufre para mejorar”.
- “Consigue el cuerpo perfecto”.
- “Quema grasa rápidamente”.
- “Entrena como una bestia”.
- “Supera tus límites” como cliché repetido.
- “Operación bikini”.
- Mensajes que generen culpa.

## 10.3 Preferir frases como

- “Entrena con seguimiento real”.
- “Un plan adaptado a ti”.
- “Gana fuerza para tu día a día”.
- “Empieza desde tu nivel”.
- “Muévete mejor. Siéntete mejor.”
- “Entrenamiento personal en un entorno cercano.”
- “No necesitas experiencia para empezar.”
- “Te acompañamos en cada paso.”

## 10.4 Llamadas a la acción

CTA principales sugeridos:

- Reserva tu primera sesión.
- Empieza a entrenar.
- Conoce nuestro método.
- Encuentra tu entrenamiento.
- Habla con el equipo.
- Ver modalidades.
- Reservar en Harbiz.

Evitar:

- Comprar ahora.
- Últimas plazas, salvo que sea real.
- Oferta irrepetible.
- No te lo pierdas.

---

# 11. Arquitectura inicial de la web

La estructura deberá ajustarse cuando el cliente confirme contenidos y funcionalidades.

## 11.1 Página de inicio

Orden recomendado:

1. Header.
2. Hero.
3. Propuesta de valor.
4. Filosofía o método.
5. Modalidades de entrenamiento.
6. Experiencia visual del centro.
7. Beneficios.
8. Comunidad.
9. Testimonios.
10. Equipo.
11. Actividades.
12. Preguntas frecuentes.
13. CTA final.
14. Footer.

## 11.2 Páginas previstas

```text
/
├── servicios/
├── equipo/
├── actividades/
├── contacto/
├── aviso-legal/
├── privacidad/
└── cookies/
```

Opcionales:

```text
├── blog/
├── entrenamiento-personal/
├── grupos-reducidos/
├── entrenamiento-mayores-50/
├── yoga/
└── primera-sesion/
```

---

# 12. Hero

## 12.1 Objetivo

El hero debe explicar en segundos:

- Qué es Elefitness.
- Para quién es.
- Qué diferencia ofrece.
- Qué debe hacer el visitante.

## 12.2 Composición recomendada

- Pantalla completa o casi completa.
- Vídeo o imagen real.
- Titular de gran tamaño.
- Texto breve.
- CTA principal.
- CTA secundario.
- Cabecera limpia.
- Indicador de scroll opcional.

## 12.3 Copy conceptual

```text
ENTRENA PARA
VIVIR MEJOR.

Entrenamiento personal y en grupos reducidos,
adaptado a tu nivel, tu cuerpo y tus objetivos.

[Reserva tu primera sesión]
[Conoce Elefitness]
```

Este copy es provisional. No debe considerarse definitivo.

## 12.4 Movimiento

- Revelado por líneas.
- Entrada escalonada.
- Ligero zoom del medio visual.
- Opacidad suave.
- Sin rebotes.
- Sin aceleraciones agresivas.

---

# 13. Modalidades de entrenamiento

Evitar una cuadrícula genérica de tarjetas pequeñas.

Presentar cada modalidad como un panel editorial.

Modalidades provisionales:

- Entrenamiento personal.
- Grupos reducidos.
- Entrenamiento de fuerza.
- Entrenamiento para mayores de 50.
- Yoga.
- GAP.
- Bailoterapia.
- Body Combat.
- Otras actividades confirmadas por el centro.

Cada modalidad debe incluir:

- Número.
- Nombre.
- Descripción.
- Imagen o vídeo.
- Beneficio principal.
- Público recomendado.
- CTA.

Ejemplo:

```text
01

ENTRENAMIENTO
PERSONAL

Una planificación adaptada a tu nivel, tus objetivos
y tu evolución, con seguimiento durante cada sesión.

[Descubrir modalidad]
```

---

# 14. Sección de filosofía

La filosofía debe comunicar:

- Adaptación.
- Seguimiento.
- Progresión.
- Seguridad.
- Salud.
- Comunidad.

Estructura recomendada:

- Etiqueta pequeña.
- Titular grande.
- Párrafo breve.
- Imagen amplia.
- Datos o principios.

Ejemplo:

```text
NO SE TRATA DE HACER MÁS.
SE TRATA DE HACERLO MEJOR.

Diseñamos cada entrenamiento para que avances de forma
segura, progresiva y sostenible.
```

---

# 15. Comunidad

La comunidad es un activo principal.

Debe mostrarse mediante:

- Fotografías de grupos.
- Actividades.
- Eventos.
- Carreras.
- Sesiones especiales.
- Momentos naturales.
- Testimonios.
- Frases breves.

No presentar la comunidad como un elemento secundario.

Posible formato:

- Galería horizontal.
- Tarjetas superpuestas.
- Scroll arrastrable.
- Mosaico editorial.
- Vídeos cortos.

---

# 16. Testimonios

## 16.1 Contenido

Cada testimonio puede incluir:

- Nombre.
- Texto.
- Valoración.
- Tiempo entrenando.
- Resultado.
- Foto opcional.
- Procedencia de la reseña.

## 16.2 Diseño

- Una reseña principal grande.
- Tarjetas secundarias.
- Navegación simple.
- Posibilidad de arrastrar.
- Fondo claro para generar contraste.
- Texto legible.
- No utilizar carruseles automáticos rápidos.

## 16.3 Reglas

- No inventar reseñas.
- No editar el sentido de testimonios reales.
- Pedir autorización cuando se use fotografía.
- Mantener ortografía sin alterar el mensaje.

---

# 17. Equipo

El equipo debe mostrarse como personas, no como fichas corporativas frías.

Cada perfil puede incluir:

- Nombre.
- Rol.
- Especialidad.
- Breve descripción.
- Fotografía.
- Frase personal.
- Certificaciones relevantes.

Evitar párrafos biográficos extensos.

---

# 18. FAQ

Preguntas sugeridas:

- ¿Necesito experiencia previa?
- ¿Puedo empezar si nunca he entrenado?
- ¿Qué diferencia hay entre entrenamiento personal y grupo reducido?
- ¿Cuántas personas hay en cada grupo?
- ¿Puedo entrenar si tengo molestias?
- ¿Cómo se reservan las sesiones?
- ¿Puedo probar antes de apuntarme?
- ¿Qué debo llevar?
- ¿Cómo funciona Harbiz?
- ¿Hay actividades para mayores de 50 años?

El acordeón debe ser accesible y funcionar con teclado.

---

# 19. Conversión y Harbiz

Actualmente Instagram enlaza a Harbiz.

La web deberá dirigir a Harbiz cuando sea necesario para:

- Alta.
- Reserva.
- Compra.
- Selección de servicio.
- Checkout.

Reglas:

- No ocultar que el enlace abre un sistema externo.
- Mantener CTA consistentes.
- Abrir en nueva pestaña solo cuando tenga sentido.
- Añadir `rel="noopener noreferrer"` a enlaces externos.
- Medir clics de conversión.
- Crear una capa visual previa si ayuda a explicar el proceso.
- No incrustar flujos de pago sin comprobar compatibilidad.

---

# 20. Navegación

## 20.1 Header

Debe ser:

- Minimalista.
- Claro.
- Ligero.
- Sticky o fixed cuando aporte valor.
- Transparente inicialmente si el contraste lo permite.
- Sólido al hacer scroll.

Elementos sugeridos:

- Logo.
- Servicios.
- Método.
- Equipo.
- Contacto.
- CTA de reserva.

## 20.2 Móvil

- Botón de menú accesible.
- Panel de pantalla completa.
- Enlaces grandes.
- CTA visible.
- Cierre mediante botón, escape y clic exterior.
- Bloqueo de scroll al abrir.

---

# 21. Footer

Debe incluir:

- Logotipo.
- Mensaje final.
- Dirección.
- Teléfono.
- Instagram.
- Horario.
- Enlace a Harbiz.
- Aviso legal.
- Privacidad.
- Cookies.
- Créditos si procede.

El footer puede tener una dirección más experimental:

- Tipografía grande.
- Fondo oscuro.
- Detalle animado sutil.
- CTA final.
- Gran espacio visual.

---

# 22. Animación

## 22.1 Principios

Las animaciones deben:

- Mejorar jerarquía.
- Guiar la lectura.
- Reforzar la experiencia.
- Mantener fluidez.
- Ser discretas.
- Respetar rendimiento.
- Respetar accesibilidad.

## 22.2 Animaciones recomendadas

- Revelado de texto por líneas.
- Máscaras verticales.
- Aparición progresiva.
- Parallax ligero.
- Escalado suave de imágenes.
- Paneles sticky.
- Secciones que se apilan.
- Desplazamiento horizontal controlado.
- Cambio gradual de fondos.
- Movimiento interno de botones.
- Flechas deslizables.
- Menú móvil animado.
- Acordeones fluidos.

## 22.3 Evitar

- Scroll-jacking.
- Movimiento excesivo.
- Cursor personalizado invasivo.
- Efectos que dificulten la lectura.
- Animaciones largas.
- Rebotes.
- Rotaciones constantes.
- Elementos que sigan el cursor sin función.
- Retrasos artificiales en la carga.
- Intro obligatoria.

## 22.4 Reduced motion

Debe existir soporte completo:

```css
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

La experiencia debe seguir funcionando sin animaciones.

---

# 23. Stack recomendado

## 23.1 Base

- Next.js.
- React.
- TypeScript.
- Tailwind CSS.

## 23.2 Animación

- GSAP.
- ScrollTrigger.
- Lenis.

## 23.3 Interacciones

- Framer Motion únicamente para:
  - Menús.
  - Modales.
  - Acordeones.
  - Transiciones sencillas.

No utilizar GSAP y Framer Motion en el mismo elemento.

## 23.4 Utilidades

- React Hook Form.
- Zod.
- Embla Carousel.
- Lucide Icons.
- next/image.
- next/font.

## 23.5 Principio de dependencias

No instalar librerías sin justificar su necesidad.

Antes de instalar una dependencia:

1. Comprobar si puede resolverse con CSS.
2. Comprobar si puede resolverse con APIs nativas.
3. Comprobar si ya existe una utilidad en el proyecto.
4. Evaluar impacto en bundle.
5. Documentar su uso.

---

# 24. Arquitectura de carpetas

```text
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── servicios/
│   │   └── page.tsx
│   ├── equipo/
│   │   └── page.tsx
│   ├── actividades/
│   │   └── page.tsx
│   ├── contacto/
│   │   └── page.tsx
│   ├── aviso-legal/
│   │   └── page.tsx
│   ├── privacidad/
│   │   └── page.tsx
│   └── cookies/
│       └── page.tsx
│
├── components/
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── mobile-menu.tsx
│   │   └── footer.tsx
│   │
│   ├── sections/
│   │   ├── hero.tsx
│   │   ├── philosophy.tsx
│   │   ├── services.tsx
│   │   ├── training-experience.tsx
│   │   ├── community.tsx
│   │   ├── testimonials.tsx
│   │   ├── team.tsx
│   │   ├── faq.tsx
│   │   └── final-cta.tsx
│   │
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── animated-heading.tsx
│   │   ├── section-label.tsx
│   │   ├── media-card.tsx
│   │   ├── accordion.tsx
│   │   └── external-link.tsx
│   │
│   └── motion/
│       ├── reveal-text.tsx
│       ├── parallax-media.tsx
│       ├── horizontal-scroll.tsx
│       ├── stack-panels.tsx
│       └── smooth-scroll-provider.tsx
│
├── content/
│   ├── services.ts
│   ├── testimonials.ts
│   ├── team.ts
│   ├── faqs.ts
│   └── site.ts
│
├── lib/
│   ├── animations.ts
│   ├── analytics.ts
│   ├── seo.ts
│   └── utils.ts
│
├── styles/
│   └── globals.css
│
└── types/
    └── index.ts
```

---

# 25. Reglas de React y Next.js

- Usar Server Components por defecto.
- Añadir `"use client"` solo cuando sea necesario.
- No convertir páginas completas en Client Components.
- Mantener lógica de animación encapsulada.
- No mezclar obtención de datos con presentación cuando complique el componente.
- Utilizar componentes pequeños y reutilizables.
- Evitar componentes excesivamente abstractos.
- Utilizar TypeScript estricto.
- No usar `any`.
- Definir interfaces o tipos claros.
- Usar `next/image`.
- Usar `next/font`.
- Utilizar Metadata API.
- Mantener rutas limpias.
- Usar enlaces semánticos.
- No utilizar botones para navegación.
- No utilizar enlaces para acciones internas.

---

# 26. Reglas de Tailwind

- Centralizar tokens en configuración o CSS variables.
- Evitar valores arbitrarios repetidos.
- No escribir clases de color diferentes para el mismo propósito.
- Crear variantes reutilizables para botones.
- Mantener las clases legibles.
- Extraer componentes cuando una combinación se repita.
- No crear abstracciones prematuras.
- No utilizar `!important` salvo casos justificados.
- Mantener consistencia en breakpoints.
- No duplicar estilos entre componentes.

---

# 27. Reglas de GSAP

- Registrar plugins una sola vez.
- Utilizar `gsap.context`.
- Limpiar animaciones al desmontar.
- Destruir ScrollTriggers.
- No seleccionar elementos globales innecesariamente.
- Utilizar refs.
- No animar `width`, `height`, `top` o `left` si puede usarse `transform`.
- Priorizar `transform` y `opacity`.
- Evitar animar demasiados elementos a la vez.
- No bloquear el scroll nativo.
- Probar animaciones en móvil.
- Desactivar efectos complejos en dispositivos de bajo rendimiento cuando proceda.

Ejemplo de limpieza:

```tsx
useLayoutEffect(() => {
  const context = gsap.context(() => {
    // animation
  }, rootRef);

  return () => context.revert();
}, []);
```

---

# 28. Responsive

## 28.1 Enfoque

- Diseñar primero la estructura móvil.
- Adaptar la experiencia editorial a pantallas pequeñas.
- No reducir simplemente el diseño de escritorio.
- Mantener legibilidad.
- Simplificar animaciones.
- Priorizar navegación y conversión.

## 28.2 Reglas

- Tamaño táctil mínimo: 44 × 44 px.
- Evitar textos desbordados.
- Evitar palabras aisladas en titulares.
- Evitar scroll horizontal involuntario.
- Convertir galerías complejas en carruseles táctiles.
- Desactivar parallax intenso.
- No reproducir vídeos pesados automáticamente si perjudican rendimiento.
- Mantener CTA visible.
- Revisar desde 320 px.
- Revisar orientación horizontal.

---

# 29. Accesibilidad

Objetivo mínimo: WCAG 2.2 AA.

Requisitos:

- HTML semántico.
- Orden correcto de encabezados.
- Contraste suficiente.
- Navegación con teclado.
- Focus visible.
- Labels en formularios.
- `aria-expanded` en acordeones.
- `aria-controls` cuando proceda.
- Texto alternativo útil.
- No describir imágenes decorativas.
- No depender solo del color.
- Evitar texto dentro de imágenes.
- Subtítulos para vídeos con voz.
- Pausa para contenido en movimiento.
- Reduced motion.
- Mensajes de error comprensibles.
- Enlaces descriptivos.

---

# 30. Rendimiento

Objetivos:

- Lighthouse Performance: 90 o superior.
- Lighthouse Accessibility: 95 o superior.
- Lighthouse Best Practices: 95 o superior.
- Lighthouse SEO: 95 o superior.

Reglas:

- Optimizar imágenes.
- Evitar scripts innecesarios.
- Lazy load por debajo del fold.
- Reservar espacio para medios.
- Reducir JavaScript cliente.
- Dividir código.
- No cargar GSAP donde no se utilice.
- No cargar vídeos grandes en móvil.
- Utilizar preload solo para recursos críticos.
- Comprimir fuentes.
- Usar `font-display: swap`.
- Evitar layout shifts.
- Medir Core Web Vitals.

---

# 31. SEO

## 31.1 Objetivos locales

La web debe posicionarse para búsquedas relacionadas con:

- Entrenamiento personal Valencia.
- Centro de entrenamiento personal Valencia.
- Entrenamiento en grupos reducidos Valencia.
- Entrenamiento de fuerza Valencia.
- Gimnasio para mayores de 50 Valencia.
- Yoga Valencia.
- Entrenador personal Valencia.

No sobreoptimizar.

## 31.2 Requisitos

- Title único.
- Meta description única.
- Canonical.
- Open Graph.
- Twitter cards.
- Sitemap.
- Robots.
- Datos estructurados.
- Información NAP consistente.
- Página de contacto clara.
- Dirección visible.
- Teléfono clicable.
- Integración con Google Maps si procede.
- Alt text descriptivo.
- URLs limpias.
- Contenido local natural.

## 31.3 Schema recomendado

- LocalBusiness.
- SportsActivityLocation.
- Organization.
- FAQPage cuando proceda.
- BreadcrumbList.

No añadir datos estructurados que no estén visibles en la página.

---

# 32. Analítica

Eventos sugeridos:

- `click_primary_cta`
- `click_harbiz`
- `click_phone`
- `click_instagram`
- `submit_contact_form`
- `view_service`
- `open_faq`
- `play_video`
- `complete_video`
- `scroll_50`
- `scroll_90`

No recopilar datos personales innecesarios.

Cumplir normativa de cookies y privacidad.

---

# 33. Formularios

Requisitos:

- Campos mínimos.
- Validación con Zod.
- Mensajes claros.
- Estados de carga.
- Confirmación de envío.
- Prevención de doble envío.
- Protección antispam.
- Consentimiento de privacidad.
- No solicitar información médica sensible desde un formulario general.
- No usar placeholders como sustituto de labels.

Campos posibles:

- Nombre.
- Teléfono.
- Correo.
- Objetivo.
- Mensaje.
- Preferencia de contacto.

---

# 34. Iconografía

- Utilizar Lucide Icons.
- Trazos simples.
- Grosor consistente.
- No mezclar familias de iconos.
- No utilizar iconos cuando el texto sea más claro.
- Tamaños coherentes.
- Iconos decorativos con `aria-hidden="true"`.

---

# 35. Estados de interfaz

Todos los elementos interactivos deben contemplar:

- Default.
- Hover.
- Focus.
- Active.
- Disabled.
- Loading.
- Error.
- Success.

Los estados no deben depender únicamente del color.

---

# 36. Botones

## 36.1 Primario

- Fondo turquesa.
- Texto oscuro.
- Forma pill.
- Tamaño amplio.
- Movimiento interno sutil en hover.

## 36.2 Secundario

- Fondo transparente.
- Borde visible.
- Texto claro u oscuro según contexto.
- Flecha opcional.

## 36.3 Reglas

- No usar más de dos CTA principales por sección.
- Mantener copy corto.
- No añadir sombras fuertes.
- No animar de manera agresiva.
- Mantener foco visible.

---

# 37. Contenido provisional pendiente

Antes de cerrar la web deben confirmarse:

- Lista definitiva de servicios.
- Horarios.
- Tarifas.
- Equipo.
- Fotografías.
- Vídeos.
- Testimonios.
- Enlaces de Harbiz.
- Dirección exacta.
- Teléfono.
- Correo.
- Redes sociales.
- Preguntas frecuentes.
- Información legal.
- Política de cancelación.
- Sesión de prueba.
- Promociones activas.
- Sistema de reservas.

No inventar datos.

Utilizar placeholders claramente identificados.

---

# 38. Flujo de trabajo para Claude Code

Antes de modificar código:

1. Leer este archivo.
2. Revisar la estructura existente.
3. Identificar componentes reutilizables.
4. Comprobar tokens.
5. Confirmar impacto responsive.
6. Confirmar impacto de accesibilidad.
7. Confirmar impacto de rendimiento.

Después de modificar código:

1. Ejecutar lint.
2. Ejecutar typecheck.
3. Ejecutar tests disponibles.
4. Revisar errores de consola.
5. Verificar desktop.
6. Verificar tablet.
7. Verificar móvil.
8. Verificar navegación con teclado.
9. Verificar reduced motion.
10. Verificar enlaces externos.

---

# 39. Criterios de aceptación visual

Una sección se considera correcta cuando:

- Respeta la paleta.
- Mantiene jerarquía tipográfica.
- Tiene suficiente espacio.
- No parece una plantilla.
- Utiliza fotografía real.
- Tiene un propósito claro.
- Mantiene consistencia.
- Funciona en móvil.
- Funciona sin animación.
- Tiene CTA claro cuando corresponde.
- No satura.
- Encaja con la personalidad de Elefitness.

---

# 40. Criterios de rechazo

Rechazar una implementación si:

- Parece una plantilla de gimnasio.
- Utiliza colores ajenos.
- Abusa de tarjetas.
- Abusa de degradados.
- Introduce animaciones molestas.
- Dificulta la lectura.
- Tiene problemas de contraste.
- Depende de hover en móvil.
- Usa imágenes de stock sin necesidad.
- Añade contenido inventado.
- Duplica componentes.
- Introduce dependencias innecesarias.
- Rompe reduced motion.
- Tiene scroll horizontal no intencionado.
- Utiliza textos agresivos o culpabilizadores.

---

# 41. Estado del documento

Este documento define la primera base de diseño y desarrollo.

Debe actualizarse cuando se reciban:

- Arquitectura final.
- Contenidos reales.
- Funcionalidades definitivas.
- Recursos visuales.
- Enlaces finales.
- Decisiones sobre reservas.
- Tarifas.
- Datos legales.
- Identidad gráfica oficial.

No eliminar reglas sin documentar el motivo.

---

# 42. Resumen operativo

Construir una web para Elefitness que:

- Mantenga la identidad oscura, neutra y turquesa de la marca.
- Utilice fotografías reales.
- Transmita salud, cercanía y profesionalidad.
- Se inspire en el ritmo editorial y visual de six2eight.com.
- No copie la referencia literalmente.
- Utilice tipografía de gran escala.
- Evite plantillas genéricas.
- Incluya movimiento suave.
- Sea accesible.
- Sea rápida.
- Funcione especialmente bien en móvil.
- Convierta visitas en reservas mediante Harbiz.
