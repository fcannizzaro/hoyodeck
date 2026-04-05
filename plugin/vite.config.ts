import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig, esmExternalRequirePlugin } from "vite";
import react from "@vitejs/plugin-react";
import { streamDeckReact } from "@fcannizzaro/streamdeck-react/vite";

const PLUGIN_DIR = "com.fcannizzaro.hoyodeck.sdPlugin";
const builtins = builtinModules.flatMap((m) => [m, `node:${m}`]);

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    conditions: ["node"],
  },
  define: {
    __DEBUG__: process.env.DEBUG === "1" ? "true" : "false",
    __CODE_SERVER_URL__: JSON.stringify(process.env.CODE_SERVER_URL ?? "http://localhost:3000"),
  },
  plugins: [
    esmExternalRequirePlugin({ external: builtins }),
    react(),
    streamDeckReact({
      uuid: "com.fcannizzaro.hoyodeck",
      nativeModules: [
        {
          importSpecifier: "@nativewindow/webview",
          bindings: {
            "darwin-arm64": {
              pkg: "webview-darwin-arm64",
              file: "native-window.darwin-arm64.node",
            },
            "darwin-x64": { pkg: "webview-darwin-x64", file: "native-window.darwin-x64.node" },
            "win32-x64": {
              pkg: "webview-win32-x64-msvc",
              file: "native-window.win32-x64-msvc.node",
            },
            "win32-arm64": {
              pkg: "webview-win32-arm64-msvc",
              file: "native-window.win32-arm64-msvc.node",
            },
          },
          exports: ["NativeWindow", "checkRuntime", "ensureRuntime", "loadHtmlOrigin"],
        },
      ],
      manifest: {
        uuid: "com.fcannizzaro.hoyodeck",
        name: "HoYo Deck",
        author: "fcannizzaro",
        description:
          "HoYoverse games utilities for Stream Deck (Genshin Impact, Honkai: Star Rail and Zenless Zone Zero)",
        icon: "imgs/plugin/icon",
        version: "1.0.0.1",
        category: "HoYo Deck",
        categoryIcon: "imgs/plugin/category",
        propertyInspectorPath: "ui/index.html",
      },
    }),
  ],
  build: {
    target: "node20",
    outDir: resolve(PLUGIN_DIR, "bin"),
    emptyOutDir: false,
    sourcemap: process.env.DEBUG === "1",
    minify: false,
    lib: {
      entry: resolve("src/plugin.ts"),
      formats: ["es"],
      fileName: () => "plugin.mjs",
    },
    rolldownOptions: {
      output: {
        codeSplitting: false,
      },
    },
  },
});
