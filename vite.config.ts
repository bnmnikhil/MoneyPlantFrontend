import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const proxyTarget = "http://localhost:8080";
// Every backend-owned path. Broker callback routes must be listed here or the
// OAuth redirect lands on Vite in dev and 404s instead of reaching the backend.
const proxied = ["/api", "/oauth2", "/login/oauth2", "/kite", "/aliceblue"];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      proxied.map((p) => [p, { target: proxyTarget, changeOrigin: true }])
    ),
  },
  build: {
    outDir: "dist",
  },
});
