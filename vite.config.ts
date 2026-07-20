import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const proxyTarget = "http://localhost:8080";
const proxied = ["/api", "/oauth2", "/login/oauth2", "/kite"];

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
