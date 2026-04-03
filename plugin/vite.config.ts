import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig, esmExternalRequirePlugin } from "vite";
import react from "@vitejs/plugin-react";
import { streamDeckReact } from "@fcannizzaro/streamdeck-react/vite";
import { lazyLoadBindings } from "./vite-plugin-lazy-load-bindings";

const PLUGIN_DIR = "com.fcannizzaro.hoyodeck.sdPlugin";
const builtins = builtinModules.flatMap((m) => [m, `node:${m}`]);

// ─── Shared build targets ─────────────────────────────────────────

/** Platforms shipped in the .sdPlugin bundle — single source of truth. */
const targets: { platform: "darwin" | "win32"; arch: "arm64" | "x64" }[] = [
  { platform: "darwin", arch: "arm64" },
  { platform: "win32", arch: "x64" },
];

// ─── Vite config ──────────────────────────────────────────────────

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
    ...lazyLoadBindings([
      {
        source: "@takumi-rs/core",
        package: "@takumi-rs/core",
        scope: "@takumi-rs",
        bindings: {
          "darwin-arm64": { pkg: "core-darwin-arm64", file: "core.darwin-arm64.node" },
          "darwin-x64": { pkg: "core-darwin-x64", file: "core.darwin-x64.node" },
          "win32-x64": { pkg: "core-win32-x64-msvc", file: "core.win32-x64-msvc.node" },
          "win32-arm64": { pkg: "core-win32-arm64-msvc", file: "core.win32-arm64-msvc.node" },
        },
        exports: [
          "Renderer",
          "OutputFormat",
          "DitheringAlgorithm",
          "AnimationOutputFormat",
          "extractResourceUrls",
        ],
      },
      {
        source: "../native-window.js",
        importer: "@nativewindow/webview",
        package: "@nativewindow/webview",
        scope: "@nativewindow",
        bindings: {
          "darwin-arm64": { pkg: "webview-darwin-arm64", file: "native-window.darwin-arm64.node" },
          "darwin-x64": { pkg: "webview-darwin-x64", file: "native-window.darwin-x64.node" },
          "win32-x64": { pkg: "webview-win32-x64-msvc", file: "native-window.win32-x64-msvc.node" },
          "win32-arm64": {
            pkg: "webview-win32-arm64-msvc",
            file: "native-window.win32-arm64-msvc.node",
          },
        },
        exports: [
          "NativeWindow",
          "init",
          "pumpEvents",
          "checkRuntime",
          "ensureRuntime",
          "loadHtmlOrigin",
        ],
      },
    ]),
    streamDeckReact({
      uuid: "com.fcannizzaro.hoyodeck",
      manifest: {
        uuid: "com.fcannizzaro.hoyodeck",
        name: "HoYo Deck",
        author: "fcannizzaro",
        description:
          "HoYoverse games utilities for Stream Deck (Genshin Impact, Honkai: Star Rail and Zenless Zone Zero)",
        icon: "imgs/plugin/icon",
        version: "1.0.0.0",
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
