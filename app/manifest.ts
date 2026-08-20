import type { MetadataRoute } from "next";

// Iconos provisionales ("EF" en la paleta de marca) hasta que Elena pase el
// logo real -- ver public/icon-192.png / icon-512.png. Sustituir esos dos
// ficheros es lo unico que hara falta cuando llegue.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Elefitness",
    short_name: "Elefitness",
    description: "Panel de reservas y gestion del centro de entrenamiento",
    start_url: "/",
    display: "standalone",
    background_color: "#171918",
    theme_color: "#171918",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
