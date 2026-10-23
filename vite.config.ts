import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@shared": path.resolve(import.meta.dirname, "shared") } },
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:5174", changeOrigin: true }, "/files": "http://localhost:5174" },
  },
});
