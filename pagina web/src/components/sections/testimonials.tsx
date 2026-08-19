import { StarIcon } from "lucide-react";
import { AnimatedHeading } from "@/components/ui/animated-heading";
import { SectionLabel } from "@/components/ui/section-label";
import { testimonials } from "@/content/testimonials";

export function Testimonials() {
  const [featured, ...rest] = testimonials;

  return (
    <section className="bg-surface-light px-6 py-20 text-text-dark lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <SectionLabel className="text-muted">Testimonios</SectionLabel>
            <AnimatedHeading
              as="h2"
              scale="section"
              lines={["LO QUE CUENTAN", "QUIENES ENTRENAN AQUÍ."]}
              className="mt-4 max-w-2xl text-text-dark"
            />
          </div>

          <p className="flex items-center gap-2 rounded-pill border border-text-dark/15 px-4 py-2 text-sm text-text-dark/80">
            <span aria-hidden="true" className="flex text-accent">
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon
                  key={i}
                  className="size-4 fill-current"
                  aria-hidden="true"
                />
              ))}
            </span>
            5,0 en Google · 32 reseñas
          </p>
        </div>

        {featured && (
          <blockquote className="mt-16 max-w-3xl">
            <p className="text-body-large text-text-dark">
              &ldquo;{featured.quote}&rdquo;
            </p>
            <footer className="mt-4 text-sm text-text-dark/70">
              {featured.name} — {featured.source}
            </footer>
          </blockquote>
        )}

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((testimonial) => (
            <blockquote
              key={testimonial.id}
              className="rounded-lg border border-text-dark/10 p-6 transition-colors duration-300 hover:border-text-dark/25"
            >
              <p className="text-sm text-text-dark">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <footer className="mt-4 text-xs text-text-dark/70">
                {testimonial.name} — {testimonial.source}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}