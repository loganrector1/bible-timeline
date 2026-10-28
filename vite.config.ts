/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Tests get their own cache so a running dev server re-optimizing dependencies
  // can't change files under them mid-run.
  cacheDir: process.env.VITEST ? "node_modules/.vitest" : "node_modules/.vite",
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
