// Service worker minimo: solo lo necesario para que el navegador considere
// la app instalable (criterio PWA). No cachea nada a proposito -- reservas,
// aforo y cobros tienen que verse siempre en vivo, cachearlos podria
// enseñarle a Elena o a una clienta un estado que ya no es real.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
