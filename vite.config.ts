import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
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
