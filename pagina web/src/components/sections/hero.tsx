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
          className="ken-burns h-full w-full rounded-none border-none"
          previewSrc="/fotos/espacio-logo.jpg"
          priority
          hideBadge
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-bg/10" />
      </div>

      <div className="max-w-3xl">
        <p className="mb-6 inline-flex items-center gap-2 rounded-pill border border-border bg-bg/50 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-text/80 backdrop-blur">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
          Grupos reducidos · Seguimiento personal
        </p>

        <AnimatedHeading
          as="h1"
          scale="hero"
          lines={["ENTRENA PARA", "VIVIR MEJOR."]}
          className="text-text"
        />

        <p className="mt-6 max-w-xl text-body-large text-text/85">
          Entrenamiento personal y en grupos reducidos, adaptado a tu nivel,
          tu cuerpo y tus objetivos.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Button href={siteConfig.whatsappUrl} external variant="primary">
            Reserva tu primera sesión
          </Button>
          <Button
            href="#filosofia"
            variant="secondary"
            className="border-text/40 text-text hover:border-accent hover:text-accent"
          >
            Conoce Elefitness
          </Button>
        </div>
      </div>
    </section>
  );
}
