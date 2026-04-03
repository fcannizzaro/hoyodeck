import { builtinModules, createRequire } from "node:module";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { defineConfig, esmExternalRequirePlugin, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { streamDeckReact } from "@fcannizzaro/streamdeck-react/vite";

const PLUGIN_DIR = "com.fcannizzaro.hoyodeck.sdPlugin";
const builtins = builtinModules.flatMap((m) => [m, `node:${m}`]);

// ─── Shared build targets ─────────────────────────────────────────

/** Platforms shipped in the .sdPlugin bundle — single source of truth. */
const targets: { platform: "darwin" | "win32"; arch: "arm64" | "x64" }[] = [
  { platform: "darwin", arch: "arm64" },
  { platform: "win32", arch: "x64" },
];

// ─── @nativewindow/webview native binding support ─────────────────

/** Maps each build target to the @nativewindow platform package + .node filename. */
const NATIVEWINDOW_BINDINGS: Record<string, { pkg: string; file: string }> = {
  "darwin-arm64": { pkg: "@nativewindow/webview-darwin-arm64", file: "native-window.darwin-arm64.node" },
  "darwin-x64": { pkg: "@nativewindow/webview-darwin-x64", file: "native-window.darwin-x64.node" },
  "win32-x64": { pkg: "@nativewindow/webview-win32-x64-msvc", file: "native-window.win32-x64-msvc.node" },
  "win32-arm64": { pkg: "@nativewindow/webview-win32-arm64-msvc", file: "native-window.win32-arm64-msvc.node" },
};

const NATIVEWINDOW_LOADER_ID = "\0nativewindow:native-loader";

/** Virtual module that replaces @nativewindow/webview's native-window.js loader at bundle time. */
const NATIVEWINDOW_LOADER_CODE = `
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let binding = null;
if (process.platform === "darwin") {
  if (process.arch === "arm64") {
    try { binding = require("./native-window.darwin-arm64.node"); } catch {}
  } else if (process.arch === "x64") {
    try { binding = require("./native-window.darwin-x64.node"); } catch {}
  }
} else if (process.platform === "win32") {
  if (process.arch === "x64") {
    try { binding = require("./native-window.win32-x64-msvc.node"); } catch {}
  } else if (process.arch === "arm64") {
    try { binding = require("./native-window.win32-arm64-msvc.node"); } catch {}
  }
}
if (!binding) {
  throw new Error(
    "[@nativewindow/webview] Failed to load native binding for " +
    process.platform + "-" + process.arch
  );
}
export const { NativeWindow, init, pumpEvents, checkRuntime, ensureRuntime, loadHtmlOrigin } = binding;
`.trim();

/**
 * Vite plugin that handles @nativewindow/webview native bindings.
 *
 * - Replaces the native-window.js loader with a virtual module that
 *   loads .node files relative to the bundle output (same pattern as
 *   @takumi-rs/core in streamdeck-react).
 * - Copies platform-specific .node files to the output directory
 *   for each entry in {@link targets}.
 */
function nativewindowPlugin(): Plugin {
  let outDir = "";

  return {
    name: "nativewindow-bindings",
    apply: "build",
    enforce: "pre",

    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },

    resolveId(source, importer) {
      // Intercept the native-window.js import from @nativewindow/webview/dist/index.js
      if (source === "../native-window.js" && importer?.includes("@nativewindow/webview")) {
        return NATIVEWINDOW_LOADER_ID;
      }
    },

    load(id) {
      if (id === NATIVEWINDOW_LOADER_ID) {
        return NATIVEWINDOW_LOADER_CODE;
      }
    },

    writeBundle() {
      const require = createRequire(import.meta.url);
      const copied: string[] = [];
      const missing: string[] = [];

      for (const { platform, arch } of targets) {
        const binding = NATIVEWINDOW_BINDINGS[`${platform}-${arch}`];
        if (!binding) continue;

        try {
          const pkgEntry = require.resolve(`${binding.pkg}/package.json`);
          const src = join(dirname(pkgEntry), binding.file);
          if (!existsSync(src)) {
            missing.push(binding.file);
            continue;
          }
          copyFileSync(src, join(outDir, binding.file));
          copied.push(binding.file);
        } catch {
          missing.push(binding.file);
        }
      }

      if (missing.length > 0) {
        console.warn(`[nativewindow] Missing native bindings: ${missing.join(", ")}`);
      }

      if (copied.length > 0) {
        console.log(`[nativewindow] Copied ${copied.join(", ")} -> ${outDir}`);
      }
    },
  };
}

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
    nativewindowPlugin(),
    streamDeckReact({
      uuid: "com.fcannizzaro.hoyodeck",
      targets,
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
