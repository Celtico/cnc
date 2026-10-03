/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import { execSync } from "node:child_process"

/** Versió que només puja: el nombre de commits de la branca, llegit de git en construir (com a rack). */
function gitVersion(): { version: string; commit: string } {
  const run = (cmd: string) => execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim()
  try {
    return { version: run("git rev-list --count HEAD"), commit: run("git rev-parse --short HEAD") }
  } catch {
    // Sense git (una build sense el repositori): el que digui l'entorn, o «dev».
    return { version: process.env.APP_VERSION ?? "dev", commit: process.env.APP_COMMIT ?? "" }
  }
}
const { version, commit } = gitVersion()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(commit),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "Mobles",
        short_name: "Mobles",
        description: "Configurador paramètric de mobles de cos per tallar a la CNC",
        // No és un camp estàndard (els navegadors l'ignoren), però diu quina build hi ha instal·lada.
        ...({ version, commit } as object),
        lang: "ca",
        theme_color: "#1a202c",
        background_color: "#1a202c",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        // Chrome d'escriptori: obrir els .moble amb l'app en fer-hi doble clic.
        file_handlers: [{ action: "/", accept: { "application/json": [".moble"] } }],
        // Un .moble obert amb doble clic va a la finestra de l'app que ja hi ha (launchQueue), no n'obre una altra.
        launch_handler: { client_mode: "focus-existing" },
        icons: [
          // Icones a sang (quadrat sencer, sense cantonades rodones): el sistema hi posa la màscara.
          { src: "pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          // Maskable: la marca dins de la zona segura (cercle del 80 %) per a Android.
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Els models 3D (`public/models/*.glb`, ~150 KB cadascun) també: les plantes surten sense connexió.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,glb,hdr}"],
        // Les pantalles d'inici d'iOS les desa el sistema en instal·lar l'app: no cal precachejar-les.
        // Fallbacks JS de Draco/Basis (de model-viewer, ~0,9 MB): el visor AR no els fa servir mai.
        globIgnores: ["splash/**", "assets/draco_*", "assets/basis_*"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Textures de foto (~14 MB) i pesos d'OIDN: no es precachegen; es desen el primer cop que es fan servir.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/textures/"),
            handler: "CacheFirst",
            options: { cacheName: "mobles-textures", expiration: { maxEntries: 120, maxAgeSeconds: 365 * 24 * 3600 }, cacheableResponse: { statuses: [200] } },
          },
          {
            // Vistes per les finestres del render (`backdrop/*.jpg`, ~0,5 MB cadascuna).
            urlPattern: ({ url }) => url.pathname.startsWith("/backdrop/"),
            handler: "CacheFirst",
            options: { cacheName: "mobles-backdrop-sw", expiration: { maxEntries: 8 }, cacheableResponse: { statuses: [200] } },
          },
          {
            // Pesos d'OIDN (1,8 MB): `oidn.ts` els valida (i esborra els dolents de la seva memòria cau).
            urlPattern: ({ url }) => url.pathname.startsWith("/oidn/"),
            handler: "CacheFirst",
            options: { cacheName: "mobles-oidn-sw", expiration: { maxEntries: 4 }, cacheableResponse: { statuses: [200] } },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        advancedChunks: {
          // Només el nucli de three (no `three/examples`: carregadors i exportadors van amb qui els fa servir, a demanda).
          // React a part i abans: si no, three el fa entrar (dependència de @react-three) i tota l'app carrega three d'entrada.
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
            { name: "three", test: /node_modules[\\/](three[\\/]build|@react-three|three-stdlib)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
})
