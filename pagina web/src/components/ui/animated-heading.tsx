import { RevealText } from "@/components/motion/reveal-text";
import { cn } from "@/lib/utils";

type HeadingTag = "h1" | "h2" | "h3";
type HeadingScale = "hero" | "section" | "heading";

interface AnimatedHeadingProps {
  lines: string[];
  as?: HeadingTag;
  scale?: HeadingScale;
  className?: string;
}

const scaleStyles: Record<HeadingScale, string> = {
  hero: "text-hero",
  section: "text-section",
  heading: "text-heading",
};

export function AnimatedHeading({
  lines,
  as: Tag = "h2",
  scale = "heading",
  className,
}: AnimatedHeadingProps) {
  return (
    <Tag
      className={cn(
        scaleStyles[scale],
        "font-display font-semibold leading-[1.05] text-text",
        className
      )}
    >
      <RevealText lines={lines} />
    </Tag>
  );
}
