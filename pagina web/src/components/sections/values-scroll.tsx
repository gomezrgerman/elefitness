"use client";

import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MediaCard } from "@/components/ui/media-card";

gsap.registerPlugin(ScrollTrigger);

const values = [
  {
    number: "01",
    word: "ENTRENA",
    description:
      "Entrenamiento personal y grupos reducidos, adaptados a tu nivel y a tus objetivos.",
    image: "/fotos/entrena-rueda.jpg",
  },
  {
    number: "02",
    word: "SUPÉRATE",
    description:
      "Fuerza progresiva y segura, sesión a sesión, desde tu punto de partida.",
    image: "/fotos/superate-grupo.jpg",
  },
  {
    number: "03",
    word: "DISFRUTA",
    description:
      "Yoga, GAP, bailoterapia y Body Combat: muévete con energía y buen ambiente.",
    image: "/fotos/disfruta-energia.jpg",
  },
  {
    number: "04",
    word: "VIVE MEJOR",
    description:
      "Tu plan, tu ritmo. Entrena para vivir mejor, hoy y siempre.",
    image: "/fotos/grupo-diversidad.jpg",
  },
];

export function ValuesScroll() {
  const sectionRef = useRef<HTMLElement>(null);  const trackRef = useRef<HTMLUListElement>(null);
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useLayoutEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion || !trackRef.current || !sectionRef.current) {
      return;
    }

    const context = gsap.context(() => {
      const track = trackRef.current!;
      const getDistance = () => track.scrollWidth - window.innerWidth;

      gsap.to(track, {
        x: () => -getDistance(),
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: () => `+=${getDistance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });
    }, sectionRef);

    return () => context.revert();
  }, []);

  if (reducedMotion) {
    return (
      <section id="valores" className="bg-bg px-6 py-20 lg:px-10 lg:py-32">
        <div className="mx-auto flex max-w-7xl flex-col gap-12">
          {values.map((value) => (
            <div
              key={value.number}
              className="grid gap-6 border-t border-border pt-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-accent">
                  {value.number}
                </p>
                <h3 className="mt-2 text-heading font-display font-semibold leading-[1.05] text-text">
                  {value.word}
                </h3>
                <p className="mt-3 max-w-xl text-body-large text-muted">
                  {value.description}
                </p>
              </div>
              <MediaCard
                label="Imagen pendiente"
                aspect="portrait"
                className="w-full max-w-sm lg:w-64"
                previewSrc={value.image}
                hideBadge
              />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="relative h-screen overflow-hidden bg-bg">
      <ul ref={trackRef} className="flex h-full">
        {values.map((value) => (
          <li
            key={value.number}
            className="flex h-full w-screen shrink-0 items-center justify-center px-6 lg:px-24"
          >
            <div className="flex w-full items-center justify-between gap-8 lg:gap-24">
              <div className="max-w-2xl">
                <p className="text-xs uppercase tracking-[0.2em] text-accent">
                  {value.number}
                </p>
                <h3 className="mt-4 text-hero font-display font-semibold leading-[1.05] tracking-tight text-text">
                  {value.word}
                </h3>
                <p className="mt-6 max-w-xl text-body-large text-muted">
                  {value.description}
                </p>
              </div>

              <MediaCard
                label="Imagen pendiente"
                aspect="portrait"
                className="hidden w-[34vw] max-w-xl lg:block"
                previewSrc={value.image}
                hideBadge
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
