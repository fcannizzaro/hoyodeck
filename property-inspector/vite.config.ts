import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  envPrefix: ["VITE_", "PUBLIC_"],
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    minify: true,
    outDir: "../plugin/com.fcannizzaro.hoyodeck.sdPlugin/ui",
    emptyOutDir: false,
  },
});
