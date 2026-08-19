"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileMenuProps {
  navLinks: { href: string; label: string }[];
  bookingHref: string;
}

export function MobileMenu({ navLinks, bookingHref }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="mobile-menu-panel"
        aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex size-11 items-center justify-center text-text"
      >
        {isOpen ? (
          <X aria-hidden="true" className="size-6" />
        ) : (
          <Menu aria-hidden="true" className="size-6" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="mobile-menu-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
            className="fixed inset-0 z-50 flex flex-col bg-bg px-6 py-5"
            onClick={() => setIsOpen(false)}
          >
            <div className="flex items-center justify-end">
              <button
                type="button"
                aria-label="Cerrar menú"
                onClick={() => setIsOpen(false)}
                className="flex size-11 items-center justify-center text-text"
              >
                <X aria-hidden="true" className="size-6" />
              </button>
            </div>

            <nav
              aria-label="Navegación móvil"
              className="mt-10 flex flex-1 flex-col justify-center gap-6"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="text-3xl font-semibold text-text"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <Button
              href={bookingHref}
              external
              variant="primary"
              className="w-full justify-center"
            >
              Reserva tu primera sesión
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
