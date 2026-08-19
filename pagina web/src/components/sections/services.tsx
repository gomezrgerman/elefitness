import { AnimatedHeading } from "@/components/ui/animated-heading";
import { SectionLabel } from "@/components/ui/section-label";
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

        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          {services.map((service, index) => (
            <div
              key={service.id}
              className={`flex flex-col justify-between gap-10 rounded-lg p-8 lg:p-12 ${
                index % 2 === 0 ? "bg-bg-soft" : "bg-surface"
              }`}
            >
              <span className="text-3xl font-display font-semibold text-accent lg:text-4xl">
                {service.number}
              </span>
              <div>
                <h3 className="text-heading font-display font-semibold leading-[1.05] text-text">
                  {service.name}
                </h3>
                <p className="mt-4 max-w-md text-body-large text-muted">
                  {service.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
