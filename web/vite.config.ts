import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { midenVitePlugin } from "@miden-sdk/vite-plugin";

// On iPhone (Safari and every iOS browser) the SDK runs its classic worker, which fetches
// "assets/miden_client_web.wasm" relative to its own /assets/ URL, a path Vite never emits: a 404 there,
// which Safari reports as a wasm MIME type error. Emit the wasm right there instead (same fix as GeoQuizz).
const assetFileNames = (a: { names?: string[] }) =>
  (a.names?.[0] ?? "").endsWith(".wasm") ? "assets/assets/miden_client_web.wasm" : "assets/[name]-[hash][extname]";

export default defineConfig({
  build: { rollupOptions: { output: { assetFileNames } } },
  worker: { rollupOptions: { output: { assetFileNames } } },
  // the SDK plugin points the SDK at its browser build; tests run on node, where the SDK reads its wasm from disk
  plugins: [react(), ...(process.env.VITEST ? [] : [midenVitePlugin({ crossOriginIsolation: true })])],
  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
    alias: {
      // The base adapter has only a `module` entry; Vitest's SSR resolver needs an explicit entry even when tests mock it.
      "@miden-sdk/miden-wallet-adapter-base": path.resolve(__dirname, "node_modules/@miden-sdk/miden-wallet-adapter-base/dist/index.js"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    server: { deps: { external: [/@miden-sdk\/miden-wallet-adapter-react/] } },
  },
});
