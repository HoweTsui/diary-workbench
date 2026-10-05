import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { libraryAssets, diaryRoot, readerRoot } from './library-assets.mjs';
import { diaryGateway } from './server/gateway.mjs';

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "127.0.0.1",
    port: Number(process.env.DIARY_WORKBENCH_PORT || 8185),
    strictPort: true,
    allowedHosts: ["terminal.local"],
    watch: { usePolling: true, interval: 300 },
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), diaryGateway({ demoRoot: diaryRoot, readerRoot }), libraryAssets()],
});
