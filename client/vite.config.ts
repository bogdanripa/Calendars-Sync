import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev the API runs separately (server: npm run dev, PORT=8080).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8080",
      "/auth": "http://localhost:8080",
    },
  },
});
