"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GalleryImage {
  id: string;
  caption: string;
  thumb: string;
  full: string;
}

interface Props {
  images: GalleryImage[];
}

// Cuadricula bento asimetrica: en movil 2x2; en pantallas medianas una grande
// (2x2), una ancha (2x1) y dos pequeñas (1x1), que llenan exactamente 4x2.
const posiciones = [
  "md:col-span-2 md:row-span-2",
  "md:col-span-2",
  "md:col-span-1",
  "md:col-span-1",
];

export function GalleryBento({ images }: Props) {
  const [abierta, setAbierta] = useState<number | null>(null);

  useEffect(() => {
    if (abierta === null) return;

    const cerrarConTeclado = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAbierta(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", cerrarConTeclado);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", cerrarConTeclado);
    };
  }, [abierta]);

  const imagenAbierta = abierta !== null ? images[abierta] : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:h-[520px] md:grid-cols-4 md:grid-rows-2 md:gap-4">
        {images.map((imagen, idx) => (
          <button
            key={imagen.id}
            type="button"
            onClick={() => setAbierta(idx)}
            aria-label={`Ampliar foto: ${imagen.caption}`}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-lg bg-bg-soft md:aspect-auto",
              posiciones[idx] ?? ""
            )}
          >
            <Image
              src={imagen.thumb}
              alt={imagen.caption}
              fill
              sizes="(min-width: 768px) 50vw, 50vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-bg/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
          </button>
        ))}
      </div>

      {imagenAbierta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={imagenAbierta.caption}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg/95 p-4 backdrop-blur"
          onClick={() => setAbierta(null)}
        >
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute right-4 top-4 rounded-full border border-border bg-bg-soft p-2 text-text transition-colors hover:text-accent"
            onClick={() => setAbierta(null)}
          >
            <X aria-hidden="true" className="size-5" />
          </button>
          <div className="relative aspect-[3/2] max-h-[75vh] w-full max-w-4xl">
            <Image
              src={imagenAbierta.full}
              alt={imagenAbierta.caption}
              fill
              sizes="(min-width: 1024px) 896px, 100vw"
              className="rounded-lg object-contain"
            />
          </div>
          <p className="text-sm text-muted">{imagenAbierta.caption}</p>
        </div>
      )}
    </>
  );
}