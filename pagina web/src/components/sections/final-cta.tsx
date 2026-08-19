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
          <Button href={siteConfig.whatsappUrl} external variant="primary">
            Reserva tu primera sesión
          </Button>
        </div>
      </div>
    </section>
  );
}
