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
            previewSrc="/fotos/filosofia-seguimiento-poster.jpg"
            previewVideo="/videos/filosofia-seguimiento.mp4"
            hideBadge
          />
        </ParallaxMedia>
      </div>
    </section>
  );
}
