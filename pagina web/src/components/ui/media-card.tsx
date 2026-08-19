import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type MediaAspect = "square" | "portrait" | "landscape";

interface MediaCardProps {
  label: string;
  aspect?: MediaAspect;
  className?: string;
  /**
   * TEMPORARY preview-only prop. When set, renders this image instead of
   * the placeholder block so the layout can be previewed with real
   * photography. Remove once real Elefitness photos are wired in.
   */
  previewSrc?: string;
  /** Muted looping video, shown instead of previewSrc when set. Requires previewSrc as poster. */
  previewVideo?: string;
  /** Forwarded to next/image for above-the-fold previews (e.g. the hero). */
  priority?: boolean;
  /** Hides the "stock image" corner badge (used on full-bleed covers). */
  hideBadge?: boolean;
}

const aspectStyles: Record<MediaAspect, string> = {
  square: "aspect-square",
  portrait: "aspect-[3/4]",
  landscape: "aspect-[4/3]",
};

export function MediaCard({
  label,
  aspect = "landscape",
  className,
  previewSrc,
  previewVideo,
  priority = false,
  hideBadge = false,
}: MediaCardProps) {
  if (previewVideo) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-lg bg-bg-soft",
          aspectStyles[aspect],
          className
        )}
      >
        <video
          className="absolute inset-0 h-full w-full object-cover"
          poster={previewSrc}
          autoPlay
          muted
          loop
          playsInline
        >
          <source src={previewVideo} type="video/mp4" />
        </video>
      </div>
    );
  }

  if (previewSrc) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-lg bg-bg-soft",
          aspectStyles[aspect],
          className
        )}
      >
        <Image
          src={previewSrc}
          alt=""
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
          priority={priority}
        />
        {!hideBadge && (
          <span className="absolute bottom-2 left-2 rounded-pill bg-bg/80 px-2 py-1 text-[10px] uppercase tracking-wide text-white">
            Imagen de stock — temporal
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-bg-soft text-center text-muted",
        aspectStyles[aspect],
        className
      )}
    >
      <ImageOff aria-hidden="true" className="size-6" />
      <span className="text-xs uppercase tracking-wide">{label}</span>
    </div>
  );
}
