/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    include: ["tests/**/*.test.ts"],
    // Vitest 5's on-disk module cache is the prime suspect for an intermittent failure
    // where every suite dies at its first `describe` before importing anything. The
    // suite is tiny, so the cache saves almost nothing.
    fsModuleCache: false,
  },
});
