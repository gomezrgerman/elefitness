"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DumbbellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { siteConfig } from "@/content/site";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#modalidades", label: "Servicios" },
  { href: "#metodo", label: "Método" },
  { href: "#valores", label: "Valores" },
  { href: "#equipo", label: "Equipo" },
  { href: "#contacto", label: "Contacto" },
];

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors duration-300",
        isScrolled
          ? "border-b border-border bg-bg/90 backdrop-blur"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-text"
        >
          <DumbbellIcon aria-hidden="true" className="size-5 text-accent" />
          {siteConfig.name}
        </Link>

        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-8 md:flex"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-text/80 transition-colors hover:text-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button
            href={siteConfig.whatsappUrl}
            external
            variant="primary"
            className="text-sm"
          >
            Reserva tu primera sesión
          </Button>
        </div>

        <MobileMenu navLinks={navLinks} bookingHref={siteConfig.whatsappUrl} />
      </div>
    </header>
  );
}
