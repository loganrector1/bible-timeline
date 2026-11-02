/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Map tiles, glyphs and terrain (by file type) never change at a URL, so they're kept once
// viewed; the style and tile indexes they're listed in are fetched fresh when online.
const MAP_HOSTS = /^https:\/\/(tiles\.openfreemap\.org|elevation-tiles-prod\.s3\.amazonaws\.com)\//;
const MAP_FILE = /\.(pbf|png|webp|jpg)$/;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable, and offline once loaded: the whole build (the data and the Bible text) is
    // precached. registerType "prompt" lets src/pwa.ts choose when a new version takes over.
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "favicon.ico", "apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "Bible Timeline",
        // The label under the home-screen icon: phones cut "Bible Timeline" short (agreed with the user).
        short_name: "Timeline",
        lang: "en-US",
        scope: "/",
        description: "The whole Bible on a timeline and a map: when things happened, who was there, and where.",
        start_url: "/",
        display: "standalone",
        background_color: "#faf6ee",
        theme_color: "#f1e9da",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        // The richer install sheet on Android and desktop Chrome.
        screenshots: [
          { src: "screenshots/narrow.png", sizes: "390x844", type: "image/png", form_factor: "narrow", label: "Paul's second journey on the map" },
          { src: "screenshots/wide.png", sizes: "1280x800", type: "image/png", form_factor: "wide", label: "The Exodus on the timeline and the map" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,mjs,css,html,svg,png,ico}"],
        globIgnores: ["screenshots/**"],
        // The Cliopatria outlines are one 1.5 MB chunk.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => MAP_HOSTS.test(url.href) && MAP_FILE.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "map-tiles",
              expiration: { maxEntries: 4000, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => MAP_HOSTS.test(url.href),
            handler: "NetworkFirst",
            options: {
              cacheName: "map-styles",
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
