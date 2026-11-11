/**
 * Memòria cau del service worker per als WASM (`vite.config.ts`, `workbox.runtimeCaching`): Draco i Basis (model-viewer)
 * es desen el primer cop que es fan servir. Aquí perquè es pugui provar.
 * **Compte**: workbox copia el text de cada `urlPattern` al service worker; no poden fer servir res de fora de la funció.
 */
export const WASM_RUNTIME_CACHING = [
  {
    urlPattern: ({ url }: { url: URL }) => url.pathname.includes("/assets/") && url.pathname.endsWith(".wasm"),
    handler: "CacheFirst" as const,
    options: { cacheName: "mobles-wasm", expiration: { maxEntries: 8 }, cacheableResponse: { statuses: [200] } },
  },
]
