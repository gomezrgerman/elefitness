"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import {
  UsersIcon,
  CalendarIcon,
  CreditCardIcon,
  LogOutIcon,
  KeyRoundIcon,
  DumbbellIcon,
  PanelLeftCloseIcon,
  PanelLeftIcon,
  HomeIcon,
} from "lucide-react";

interface TabItem {
  href: string;
  label: string;
  icono: typeof DumbbellIcon;
}

const ICONOS_POR_LABEL: Record<string, typeof DumbbellIcon> = {
  Resumen: HomeIcon,
  Clientes: UsersIcon,
  Clases: CalendarIcon,
  Cobros: CreditCardIcon,
};

function ShapeArea() {
  return (
    <div className="ambient-shapes absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="bg-shape bg-shape-1 absolute inset-0 w-full h-full" viewBox="0 0 200 200" fill="none">
        <circle className="shape-element opacity-0" cx="40" cy="60" r="20" fill="oklch(0.52 0.036 185 / 0.35)" />
        <circle className="shape-element opacity-0" cx="150" cy="40" r="28" fill="oklch(0.68 0.041 181 / 0.28)" />
        <circle className="shape-element opacity-0" cx="100" cy="160" r="36" fill="oklch(0.52 0.036 185 / 0.22)" />
      </svg>
      <svg className="bg-shape bg-shape-2 absolute inset-0 w-full h-full" viewBox="0 0 200 200" fill="none">
        <path className="shape-element opacity-0" d="M0 100 Q50 40, 100 100 T 200 100" stroke="oklch(0.52 0.036 185 / 0.40)" strokeWidth="24" fill="none" />
        <path className="shape-element opacity-0" d="M0 150 Q50 80, 100 150 T 200 150" stroke="oklch(0.68 0.041 181 / 0.30)" strokeWidth="16" fill="none" />
      </svg>
      <svg className="bg-shape bg-shape-3 absolute inset-0 w-full h-full" viewBox="0 0 200 200" fill="none">
        <circle className="shape-element opacity-0" cx="30" cy="30" r="5" fill="oklch(0.52 0.036 185 / 0.50)" />
        <circle className="shape-element opacity-0" cx="100" cy="30" r="6" fill="oklch(0.68 0.041 181 / 0.45)" />
        <circle className="shape-element opacity-0" cx="170" cy="30" r="5" fill="oklch(0.52 0.036 185 / 0.50)" />
        <circle className="shape-element opacity-0" cx="60" cy="100" r="7" fill="oklch(0.68 0.041 181 / 0.40)" />
        <circle className="shape-element opacity-0" cx="130" cy="100" r="6" fill="oklch(0.52 0.036 185 / 0.40)" />
        <circle className="shape-element opacity-0" cx="30" cy="170" r="5" fill="oklch(0.52 0.036 185 / 0.45)" />
        <circle className="shape-element opacity-0" cx="100" cy="170" r="6" fill="oklch(0.68 0.041 181 / 0.45)" />
        <circle className="shape-element opacity-0" cx="170" cy="170" r="5" fill="oklch(0.52 0.036 185 / 0.45)" />
      </svg>
      <svg className="bg-shape bg-shape-4 absolute inset-0 w-full h-full" viewBox="0 0 200 200" fill="none">
        <path className="shape-element opacity-0" d="M50 50 Q85 15, 100 50 Q115 85, 100 100 Q85 115, 50 100 Q15 85, 50 50" fill="oklch(0.52 0.036 185 / 0.25)" />
      </svg>
      <svg className="bg-shape bg-shape-5 absolute inset-0 w-full h-full" viewBox="0 0 200 200" fill="none">
        <line className="shape-element opacity-0" x1="0" y1="60" x2="160" y2="200" stroke="oklch(0.52 0.036 185 / 0.30)" strokeWidth="14" />
        <line className="shape-element opacity-0" x1="60" y1="0" x2="200" y2="140" stroke="oklch(0.68 0.041 181 / 0.25)" strokeWidth="12" />
      </svg>
    </div>
  );
}

interface Props {
  tabs: TabItem[];
  marca?: string;
  children?: ReactNode;
}

export function BarraLateral({ tabs, marca = "Elefitness", children }: Props) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const [colapsada, setColapsada] = useState(false);
  const [hoverExpandida, setHoverExpandida] = useState(false);

  const expandida = !colapsada || hoverExpandida;

  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      const items = containerRef.current!.querySelectorAll(".sidebar-link[data-shape]");
      const shapesContainer = containerRef.current!.querySelector(".ambient-shapes");

      items.forEach((item) => {
        const shapeIndex = item.getAttribute("data-shape");
        const shape = shapesContainer
          ? shapesContainer.querySelector(`.bg-shape-${shapeIndex}`)
          : null;
        if (!shape) return;

        const shapeEls = shape.querySelectorAll(".shape-element");

        const onEnter = () => {
          shapesContainer?.querySelectorAll(".bg-shape").forEach((s) => s.classList.remove("active"));
          shape.classList.add("active");
          gsap.fromTo(
            shapeEls,
            { scale: 0.5, opacity: 0, rotation: -8 },
            { scale: 1, opacity: 1, rotation: 0, duration: 0.5, stagger: 0.06, ease: "back.out(1.7)", overwrite: "auto" }
          );
        };

        const onLeave = () => {
          gsap.to(shapeEls, {
            scale: 0.8, opacity: 0, duration: 0.25, ease: "power2.in",
            onComplete: () => shape.classList.remove("active"),
            overwrite: "auto",
          });
        };

        item.addEventListener("mouseenter", onEnter);
        item.addEventListener("mouseleave", onLeave);
      });
    }, containerRef);

    return () => ctx.revert();
  }, [expandida]);

  return (
    <aside
      ref={containerRef}
      onMouseEnter={() => setHoverExpandida(true)}
      onMouseLeave={() => setHoverExpandida(false)}
      className={cn(
        "hidden md:flex md:flex-col md:shrink-0 md:border-r md:border-border md:bg-card/60 md:backdrop-blur-sm md:h-screen md:sticky md:top-0 transition-all duration-300 ease-out",
        expandida ? "md:w-56" : "md:w-14"
      )}
    >
      <div className={cn(
        "flex items-center border-b border-border transition-all duration-300",
        expandida ? "gap-2 px-5 py-4" : "justify-center px-0 py-3"
      )}>
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/20">
          <DumbbellIcon className="size-4 text-primary" />
        </div>
        {expandida && (
          <span className="font-heading text-sm font-semibold tracking-tight whitespace-nowrap overflow-hidden">
            {marca}
          </span>
        )}
      </div>

      <button
        onClick={() => setColapsada(!colapsada)}
        className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5",
          expandida ? "px-3" : "justify-center"
        )}
        aria-label={colapsada ? "Expandir sidebar" : "Colapsar sidebar"}
      >
        {colapsada ? (
          <PanelLeftIcon className="size-3.5 shrink-0" />
        ) : (
          <PanelLeftCloseIcon className="size-3.5 shrink-0" />
        )}
        {expandida && <span className="whitespace-nowrap overflow-hidden">Colapsar</span>}
      </button>

      <nav className="flex flex-col gap-0.5 px-2 py-2 flex-1 relative">
        <ShapeArea />
        {tabs.map((tab) => {
          const Icono = tab.icono;
          // Un tab "raiz" (ej. /admin) no puede usar el mismo prefijo que
          // el resto: pathname.startsWith("/admin/") es cierto en /admin/clientes
          // tambien, lo que marcaria "Resumen" como activo en todas las paginas.
          const esTabRaiz = tab.href.split("/").filter(Boolean).length === 1;
          const activo = esTabRaiz
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              data-shape={ICONOS_POR_LABEL[tab.label] ? String(Object.keys(ICONOS_POR_LABEL).indexOf(tab.label) + 1) : "1"}
              className={cn(
                "sidebar-link relative z-10 flex items-center rounded-lg text-sm transition-all duration-200",
                expandida ? "gap-3 px-3 py-2" : "justify-center px-0 py-2",
                activo
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icono className="size-4 shrink-0" aria-hidden="true" />
              {expandida && <span className="whitespace-nowrap overflow-hidden">{tab.label}</span>}
              {activo && expandida && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-full bg-primary" />
              )}
              {activo && !expandida && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
        {children}
      </nav>
    </aside>
  );
}

export function SidebarLogout({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="px-2 py-3 border-t border-border mt-auto flex flex-col gap-0.5">
      <Link
        href="/cambiar-contrasena"
        className="sidebar-link relative z-10 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-200"
      >
        <KeyRoundIcon className="size-4 shrink-0" aria-hidden="true" />
        <span>Cambiar contraseña</span>
      </Link>
      <button
        onClick={onLogout}
        aria-label="Cerrar sesion"
        className="sidebar-link relative z-10 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-200"
      >
        <LogOutIcon className="size-4 shrink-0" aria-hidden="true" />
        <span>Cerrar sesion</span>
      </button>
    </div>
  );
}
