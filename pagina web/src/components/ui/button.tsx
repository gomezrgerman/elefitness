import Link from "next/link";
import { cn } from "@/lib/utils";
import { ExternalLink } from "@/components/ui/external-link";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps {
  href: string;
  variant?: ButtonVariant;
  external?: boolean;
  className?: string;
  children: React.ReactNode;
}

const baseStyles =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-pill px-6 py-3 text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-text-dark hover:bg-accent-soft",
  secondary:
    "border border-border text-text hover:border-accent hover:text-accent",
};

export function Button({
  href,
  variant = "primary",
  external = false,
  className,
  children,
}: ButtonProps) {
  const classes = cn(baseStyles, variantStyles[variant], className);

  if (external) {
    return (
      <ExternalLink href={href} className={classes} showIcon={false}>
        {children}
      </ExternalLink>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
