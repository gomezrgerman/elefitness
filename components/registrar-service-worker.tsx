"use client";

import { useEffect } from "react";

export function RegistrarServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Instalar la PWA es una mejora, no un requisito: si falla el
        // registro (navegador sin soporte, iframe, etc.) la app sigue
        // funcionando igual desde el navegador normal.
      });
    }
  }, []);

  return null;
}
