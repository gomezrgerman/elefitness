import { AnimatedHeading } from "@/components/ui/animated-heading";
import { SectionLabel } from "@/components/ui/section-label";
import { MediaCard } from "@/components/ui/media-card";
import { team } from "@/content/team";
import { stockPreviewImages } from "@/content/stock-preview-images";

const teamPreviewImages: Record<string, (width: number) => string> = {
  elena: stockPreviewImages.womanPortrait,
  ivan: stockPreviewImages.manPortrait,
};

export function Team() {
  return (
    <section id="equipo" className="px-6 py-20 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionLabel>Equipo</SectionLabel>
        <AnimatedHeading
          as="h2"
          scale="section"
          lines={["LAS PERSONAS DETRÁS", "DE ELEFITNESS."]}
          className="mt-4 max-w-2xl"
        />

        <div className="mt-16 grid gap-10 sm:grid-cols-2">
          {team.map((member) => (
            <div key={member.id}>
              <MediaCard
                label="Foto pendiente"
                aspect="portrait"
                className="w-full"
                previewSrc={teamPreviewImages[member.id]?.(600)}
              />
              <h3 className="mt-5 text-xl font-display font-semibold text-text">
                {member.name}
              </h3>
              <p className="mt-1 text-sm text-accent">{member.role}</p>
              <p className="mt-3 max-w-sm text-sm text-muted">{member.bio}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
