import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExternalLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  showIcon?: boolean;
}

export function ExternalLink({
  href,
  showIcon = true,
  className,
  children,
  ...props
}: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    >
      {children}
      {showIcon && (
        <ArrowUpRight aria-hidden="true" className="size-[1em]" />
      )}
    </a>
  );
}
