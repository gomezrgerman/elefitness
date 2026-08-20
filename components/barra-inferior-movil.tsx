"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

interface TabItem {
  href: string;
  label: string;
  icono: ComponentType<{ className?: string }>;
}

interface Props {
  tabs: TabItem[];
}

// Un tab "raiz" (ej. /admin) no puede usar prefijo o se marcaria activo
// tambien en /admin/clientes. Mismo criterio que en BarraLateral.
function coincide(pathname: string, href: string): boolean {
  const esTabRaiz = href.split("/").filter(Boolean).length === 1;
  return esTabRaiz ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

// Barra de pestañas fija abajo, estilo iOS: mejor alcance con el pulgar en
// movil que una barra arriba. Solo por debajo de md -- en tablet/escritorio
// la navegacion sigue siendo BarraLateral.
export function BarraInferiorMovil({ tabs }: Props) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegacion principal"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tabs.map((tab) => {
        const Icono = tab.icono;
        const activo = coincide(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
              activo ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className={cn("flex items-center justify-center rounded-full px-3 py-0.5 transition-colors", activo && "bg-primary/15")}>
              <Icono className="size-5 shrink-0" aria-hidden="true" />
            </span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
