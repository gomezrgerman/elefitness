"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import {
  UsersIcon,
  CalendarIcon,
  CreditCardIcon,
  HomeIcon,
} from "lucide-react";

interface TabItem {
  href: string;
  label: string;
}

interface Props {
  tabs: TabItem[];
  children?: ReactNode;
}

const ICONOS: Record<string, typeof UsersIcon> = {
  Resumen: HomeIcon,
  Clientes: UsersIcon,
  Clases: CalendarIcon,
  Cobros: CreditCardIcon,
};

// Mismo motivo que en BarraLateral: un tab "raiz" (ej. /admin) no puede
// usar prefijo, o se marcaria activo tambien en /admin/clientes.
function coincide(pathname: string, href: string): boolean {
  const esTabRaiz = href.split("/").filter(Boolean).length === 1;
  return esTabRaiz ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

export function PestanasMovil({ tabs, children }: Props) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  const activeIndex = tabs.findIndex((tab) => coincide(pathname, tab.href));

  useEffect(() => {
    if (!navRef.current || !indicatorRef.current) return;

    const ctx = gsap.context(() => {
      const activeLink = navRef.current!.querySelector(
        `.tab-link[data-index="${activeIndex}"]`
      ) as HTMLElement | null;

      if (activeLink && indicatorRef.current) {
        gsap.to(indicatorRef.current, {
          x: activeLink.offsetLeft,
          width: activeLink.offsetWidth,
          duration: 0.5,
          ease: "elastic.out(1, 0.6)",
        });
      }

      const links = navRef.current!.querySelectorAll(".tab-link");
      links.forEach((link) => {
        const onEnter = () => {
          gsap.to(link, { scale: 1.02, duration: 0.25, ease: "power2.out" });
        };
        const onLeave = () => {
          gsap.to(link, { scale: 1, duration: 0.25, ease: "power2.out" });
        };
        link.addEventListener("mouseenter", onEnter);
        link.addEventListener("mouseleave", onLeave);
      });
    }, navRef);

    return () => ctx.revert();
  }, [activeIndex]);

  return (
    <nav
      ref={navRef}
      className="md:hidden relative flex items-center gap-0 border-b border-border overflow-x-auto"
    >
      <div
        ref={indicatorRef}
        className="absolute bottom-0 h-0.5 rounded-full bg-primary"
        style={{
          left: 0,
          width: tabs.length > 0 ? `${100 / tabs.length}%` : "0%",
        }}
      />
      {tabs.map((tab, idx) => {
        const Icono = ICONOS[tab.label];
        const activo = idx === activeIndex;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-index={idx}
            className={cn(
              "tab-link relative flex flex-1 items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium transition-colors duration-200 whitespace-nowrap",
              activo ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icono && <Icono className="size-3.5 shrink-0" />}
            <span>{tab.label}</span>
          </Link>
        );
      })}
      {children}
    </nav>
  );
}
