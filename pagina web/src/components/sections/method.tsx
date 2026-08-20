import Image from "next/image";
import { AnimatedHeading } from "@/components/ui/animated-heading";
import { SectionLabel } from "@/components/ui/section-label";

const steps = [
  {
    number: "01",
    word: "CUÉNTANOS TU OBJETIVO",
    description:
      "Una primera conversación para conocer tu nivel, tus horarios y lo que quieres conseguir.",
    className: "bg-bg-soft",
  },
  {
    number: "02",
    word: "CREAMOS TU PLAN PERSONALIZADO",
    description:
      "Sesiones adaptadas a ti, en grupos reducidos, con seguimiento real en cada clase.",
    className: "bg-surface",
  },
  {
    number: "03",
    word: "CAMBIA TU ESTILO DE VIDA",
    description:
      "Revisamos tu progreso y ajustamos el plan para que sigas evolucionando y mejorando sin estancarte.",
    className: "bg-surface",
  },
];

export function Method() {
  return (
    <section id="metodo" className="relative">
      <div className="relative sticky top-0 flex h-screen flex-col items-start justify-center overflow-hidden px-6 lg:px-24">
        <Image
          src="/fotos/grupo-plancha.jpg"
          alt=""
          fill
          sizes="100vw"
          className="-z-20 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-bg via-bg/85 to-bg/50" />
        <SectionLabel>Nuestro método</SectionLabel>
        <AnimatedHeading
          as="h2"
          scale="section"
          lines={["TRES PASOS,", "UN OBJETIVO: TÚ."]}
          className="mt-4 max-w-3xl"
        />
        <p className="mt-6 max-w-xl text-body-large text-muted">
          Sin complicaciones. Así de simple es convertir el entrenamiento en
          un hábito.
        </p>
      </div>

      {steps.map((step) => (
        <div
          key={step.number}
          className={`sticky top-0 flex h-screen flex-col items-start justify-center rounded-t-3xl px-6 lg:px-24 ${step.className}`}
        >
          <p className="text-2xl font-semibold tracking-tight text-accent lg:text-4xl">
            {step.number}
          </p>
          <h3 className="mt-6 text-heading font-display font-semibold leading-[1.05] tracking-tight text-text lg:text-section">
            {step.word}
          </h3>
          <p className="mt-6 max-w-xl text-body-large text-muted">
            {step.description}
          </p>
        </div>
      ))}
    </section>
  );
}