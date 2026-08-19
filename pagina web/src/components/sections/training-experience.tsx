import { AnimatedHeading } from "@/components/ui/animated-heading";
import { SectionLabel } from "@/components/ui/section-label";
import { MediaCard } from "@/components/ui/media-card";

const galleryItems = [
  { label: "Foto del espacio pendiente", preview: "/fotos/equipo-espalda.jpg" },
  { label: "Foto de entrenamiento pendiente", preview: "/fotos/entrenamiento-sentadilla.jpg" },
  { label: "Foto de grupo pendiente", preview: "/fotos/carrera-equipo.jpg" },
  { label: "Foto de detalle pendiente", preview: "/fotos/detalle-peso.jpg" },
];

export function TrainingExperience() {
  return (
    <section className="px-6 py-20 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionLabel>El centro</SectionLabel>
        <AnimatedHeading
          as="h2"
          scale="section"
          lines={["UN ESPACIO PENSADO", "PARA ENTRENAR BIEN."]}
          className="mt-4 max-w-2xl"
        />

        <div className="mt-16 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {galleryItems.map((item, index) => (
            <MediaCard
              key={item.label}
              label={item.label}
              aspect={index % 2 === 0 ? "portrait" : "square"}
              className="w-full"
              previewSrc={item.preview}
              hideBadge
            />
          ))}
        </div>
      </div>
    </section>
  );
}
