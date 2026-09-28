/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Mobles",
        short_name: "Mobles",
        description: "Configurador paramètric de mobles de cos per tallar a la CNC",
        lang: "ca",
        theme_color: "#1a202c",
        background_color: "#1a202c",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        // Chrome d'escriptori: obrir els .moble amb l'app en fer-hi doble clic.
        file_handlers: [{ action: "/", accept: { "application/json": [".moble"] } }],
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [{ name: "three", test: /node_modules[\\/](three|@react-three|three-stdlib)[\\/]/ }],
        },
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
})
