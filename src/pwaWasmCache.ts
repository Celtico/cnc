/**
 * Memòries cau del service worker per als WASM (`vite.config.ts`, `workbox.runtimeCaching`): OpenCascade
 * (`occt-import-js`, ~7,6 MB, només per importar ferratges) va **a part** dels de Draco i Basis. Amb tots a la mateixa
 * memòria de 4 entrades, els tres petits el treien i s'havia de tornar a baixar. Aquí perquè es pugui provar.
 * **Compte**: workbox copia el text de cada `urlPattern` al service worker; no poden fer servir res de fora de la funció.
 */
export const WASM_RUNTIME_CACHING = [
  {
    urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/assets/occt-import-js") && url.pathname.endsWith(".wasm"),
    handler: "CacheFirst" as const,
    // Dues: la d'ara i la d'abans mentre s'actualitza l'app.
    options: { cacheName: "mobles-occt", expiration: { maxEntries: 2 }, cacheableResponse: { statuses: [200] } },
  },
  {
    urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/assets/") && !url.pathname.startsWith("/assets/occt-import-js") && url.pathname.endsWith(".wasm"),
    handler: "CacheFirst" as const,
    options: { cacheName: "mobles-wasm", expiration: { maxEntries: 8 }, cacheableResponse: { statuses: [200] } },
  },
]
