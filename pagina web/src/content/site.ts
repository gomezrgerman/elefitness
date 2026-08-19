import type { SiteConfig } from "@/types";

// Datos confirmados (Google Business, ago 2026).
// La reserva irá por la app de Elefitness en el futuro; mientras tanto,
// los CTAs abren WhatsApp con un mensaje predefinido para Elena.
export const siteConfig: SiteConfig = {
  name: "Elefitness",
  tagline: "Entrena para vivir mejor.",
  address: "Plaça d'Enric Granados, 15, Patraix, 46018 València",
  phone: "656 97 45 14",
  instagramUrl: "https://www.instagram.com/grupo_elefitness/",
  hours:
    "Lunes y miércoles 7:00–21:00\nMartes y jueves 7:00–13:30 y 16:00–21:00\nViernes 9:00–16:00\nSábado y domingo cerrado",
  whatsappUrl:
    "https://wa.me/34663748766?text=Hola%20Elena%2C%20he%20visto%20vuestra%20p%C3%A1gina%20web%20y%20me%20gustar%C3%ADa%20apuntarme.%20%C2%BFPodr%C3%ADas%20darme%20m%C3%A1s%20informaci%C3%B3n%3F",
};
