/*
 * Service worker de App-Llito.
 * - Archivos estáticos (/_astro, iconos, fuentes): de la caché, y se renuevan solos al cambiar de versión.
 * - Páginas: siempre de la red (los datos son compartidos y deben estar al día).
 *   Sin conexión, se enseña /offline.html.
 * No se guardan en caché páginas con datos de la familia.
 */
const VERSION = "llito-v1";
const ESTATICOS = ["/offline.html", "/favicon.svg", "/iconos/icono-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ESTATICOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Páginas: red primero; sin conexión, la página de aviso
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }

  // Estáticos con nombre único (cambian de nombre en cada despliegue) y fuentes: caché primero
  const estatico =
    (url.origin === location.origin && (url.pathname.startsWith("/_astro/") || url.pathname.startsWith("/iconos/"))) ||
    url.hostname === "fonts.gstatic.com" ||
    url.hostname === "fonts.googleapis.com";
  if (estatico) {
    e.respondWith(
      caches.match(req).then(
        (enCache) =>
          enCache ||
          fetch(req).then((res) => {
            if (res.ok || res.type === "opaque") {
              const copia = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copia));
            }
            return res;
          }),
      ),
    );
  }
});
