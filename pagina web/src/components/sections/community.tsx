import { AnimatedHeading } from "@/components/ui/animated-heading";
import { SectionLabel } from "@/components/ui/section-label";
import {
  GalleryBento,
  type GalleryImage,
} from "@/components/ui/gallery-bento";

// Fotos reales del centro (agosto 2026), con el mismo tratamiento de color
// que el resto de la web. Faltan las de yoga y actividades dirigidas -- se
// añaden en cuanto Elena confirme ese contenido.
const galleryImages: GalleryImage[] = [
  {
    id: "espacio",
    caption: "Nuestro espacio",
    thumb: "/fotos/espacio-logo.jpg",
    full: "/fotos/espacio-logo.jpg",
  },
  {
    id: "grupo",
    caption: "Entrenamiento en grupo",
    thumb: "/fotos/grupo-plancha.jpg",
    full: "/fotos/grupo-plancha.jpg",
  },
  {
    id: "diversidad",
    caption: "Todos los niveles y edades",
    thumb: "/fotos/grupo-diversidad.jpg",
    full: "/fotos/grupo-diversidad.jpg",
  },
  {
    id: "energia",
    caption: "Sesiones con energía",
    thumb: "/fotos/energia-banda.jpg",
    full: "/fotos/energia-banda.jpg",
  },
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
          <GalleryBento images={galleryImages} />
        </div>
      </div>
    </section>
  );
}