import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    outDir: "../plugin/com.fcannizzaro.hoyodeck.sdPlugin/ui",
    emptyOutDir: false,
  },
});
