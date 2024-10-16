import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import genezioLocalSDKReload from "@genezio/vite-plugin-genezio";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), genezioLocalSDKReload()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
