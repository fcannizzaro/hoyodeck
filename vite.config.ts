import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    alias: {
      "@nativewindow/webview": fileURLToPath(
        new URL("./plugin/tests/fixtures/webview.ts", import.meta.url),
      ),
    },
    include: ["plugin/tests/**/*.test.{ts,mjs}"],
    environment: "node",
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    ignorePatterns: ["dist/**", ".agents", ".git", "server", "manifest.json"],
  },
});
