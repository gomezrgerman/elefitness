"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface HorizontalScrollProps {
  children: React.ReactNode[];
  className?: string;
}

export function HorizontalScroll({
  children,
  className,
}: HorizontalScrollProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    containScroll: "trimSnaps",
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateButtons = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const raf = requestAnimationFrame(updateButtons);
    emblaApi.on("select", updateButtons);
    emblaApi.on("reInit", updateButtons);
    return () => cancelAnimationFrame(raf);
  }, [emblaApi, updateButtons]);

  return (
    <div className={cn("relative", className)}>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-5">
          {children.map((child, index) => (
            <div
              key={index}
              className="min-w-0 shrink-0 grow-0 basis-[85%] sm:basis-[45%] lg:basis-[32%]"
            >
              {child}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          aria-label="Anterior"
          disabled={!canScrollPrev}
          onClick={() => emblaApi?.scrollPrev()}
          className="flex size-11 items-center justify-center rounded-pill border border-border text-text hover:border-accent hover:text-accent disabled:opacity-30"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Siguiente"
          disabled={!canScrollNext}
          onClick={() => emblaApi?.scrollNext()}
          className="flex size-11 items-center justify-center rounded-pill border border-border text-text hover:border-accent hover:text-accent disabled:opacity-30"
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
      </div>
    </div>
  );
}
