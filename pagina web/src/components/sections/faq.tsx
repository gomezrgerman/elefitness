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
