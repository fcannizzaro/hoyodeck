/**
 * vite-plugin-lazy-load-bindings
 *
 * Vite plugin that replaces native napi-rs `.node` binding imports with
 * self-contained virtual ES modules that download the matching platform
 * binary from the npm registry at runtime.
 *
 * Instead of bundling `.node` files for every target platform, each
 * binary is downloaded once on first use and cached next to the output
 * bundle.
 */

import { readFileSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, ResolvedConfig } from "vite";

// ─── Public types ─────────────────────────────────────────────────

export interface NativeBindingConfig {
  /**
   * Import specifier to intercept.
   *
   * - Bare specifier — e.g. `"@takumi-rs/core"`
   * - Relative path  — e.g. `"../native-window.js"` (pair with {@link importer})
   */
  source: string;

  /**
   * When set, the intercept only matches if the importing file's path
   * includes this string (e.g. `"@nativewindow/webview"`).
   *
   * Required for relative-path sources to scope the match.
   */
  importer?: string;

  /**
   * Package name used to resolve the installed version at build time
   * (e.g. `"@nativewindow/webview"`).
   */
  package: string;

  /** npm scope for the platform sub-packages (e.g. `"@nativewindow"`). */
  scope: string;

  /**
   * Map of `"platform-arch"` keys to the npm sub-package name and
   * `.node` filename for that target.
   *
   * @example
   * {
   *   "darwin-arm64": { pkg: "webview-darwin-arm64", file: "native-window.darwin-arm64.node" },
   *   "win32-x64":    { pkg: "webview-win32-x64-msvc", file: "native-window.win32-x64-msvc.node" },
   * }
   */
  bindings: Record<string, { pkg: string; file: string }>;

  /** Named exports to re-export from the native binding. */
  exports: string[];
}

// ─── Version resolution ───────────────────────────────────────────

/**
 * Resolve the installed version of a package by walking up from its
 * entry point to find `package.json`.
 *
 * This bypasses strict `exports` maps that don't expose `./package.json`.
 */
function readPackageVersion(pkgName: string): string {
  const entryPath = fileURLToPath(import.meta.resolve(pkgName));
  let dir = dirname(entryPath);
  while (dir !== dirname(dir)) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
      if (pkg.name === pkgName) return pkg.version;
    } catch {}
    dir = dirname(dir);
  }
  throw new Error(`[lazy-load-bindings] Could not resolve version for ${pkgName}`);
}

// ─── Virtual module codegen ───────────────────────────────────────

/**
 * Build a self-contained ESM virtual module that, at runtime:
 *
 *  1. Checks if the platform-matching `.node` file exists locally (cached).
 *  2. If missing, downloads the npm tarball, gunzips it, extracts the
 *     `.node` file with a minimal tar parser, and writes it to disk.
 *  3. Loads and re-exports the native binding via `createRequire`.
 *
 * Uses top-level `await` (Node 14.8+ ESM).
 */
function buildRuntimeLoader(opts: {
  scope: string;
  version: string;
  bindings: Record<string, { pkg: string; file: string }>;
  exports: string[];
  label: string;
}): string {
  return `
import { createRequire } from "node:module";
import { existsSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dir = dirname(fileURLToPath(import.meta.url));

const VERSION = ${JSON.stringify(opts.version)};
const SCOPE = ${JSON.stringify(opts.scope)};
const BINDINGS = ${JSON.stringify(opts.bindings)};

const key = \`\${process.platform}-\${process.arch}\`;
const entry = BINDINGS[key];
if (!entry) {
  throw new Error("[${opts.label}] Unsupported platform: " + key);
}

const nodePath = join(__dir, entry.file);

if (!existsSync(nodePath)) {
  const url = \`\${SCOPE}/\${entry.pkg}/-/\${entry.pkg}-\${VERSION}.tgz\`;
  console.log("[${opts.label}] Downloading native binding from npm: " + entry.pkg + "@" + VERSION);

  const res = await fetch("https://registry.npmjs.org/" + url);
  if (!res.ok) {
    throw new Error("[${opts.label}] Failed to download native binding (" + res.status + "): " + url);
  }

  const tar = gunzipSync(Buffer.from(await res.arrayBuffer()));

  // Minimal tar parser — scan 512-byte headers until we find the .node file.
  let offset = 0;
  let found = false;
  while (offset < tar.length) {
    if (tar[offset] === 0) break;
    const name = tar.subarray(offset, offset + 100).toString("utf8").replace(/\\0.*$/, "");
    const size = parseInt(tar.subarray(offset + 124, offset + 136).toString("utf8").trim(), 8) || 0;
    offset += 512;
    if (name.endsWith(entry.file)) {
      writeFileSync(nodePath, tar.subarray(offset, offset + size));
      found = true;
      break;
    }
    offset += Math.ceil(size / 512) * 512;
  }

  if (!found) {
    throw new Error("[${opts.label}] " + entry.file + " not found in npm tarball");
  }
  console.log("[${opts.label}] Cached native binding: " + entry.file);
}

const binding = require(nodePath);
export const { ${opts.exports.join(", ")} } = binding;
`.trim();
}

// ─── Plugin factory ───────────────────────────────────────────────

/**
 * Create Vite plugins that replace native napi-rs `.node` binding imports
 * with virtual modules that download the matching platform binary from npm
 * at runtime.
 *
 * Returns two plugins:
 *
 * 1. **`lazy-load-bindings`** (`enforce: "pre"`) — intercepts
 *    configured imports and serves virtual download-on-demand modules.
 * 2. **`lazy-load-bindings-cleanup`** (`enforce: "post"`) — removes any
 *    `.node` files that other plugins copy to the output directory
 *    (e.g. `streamDeckReact`). Only active in production builds — in
 *    dev/watch mode the locally-copied binaries act as a cache so the
 *    runtime loader skips the download.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { lazyLoadBindings } from "./vite-plugin-lazy-load-bindings";
 *
 * export default defineConfig({
 *   plugins: [
 *     ...lazyLoadBindings([
 *       {
 *         source: "@takumi-rs/core",
 *         package: "@takumi-rs/core",
 *         scope: "@takumi-rs",
 *         bindings: {
 *           "darwin-arm64": { pkg: "core-darwin-arm64", file: "core.darwin-arm64.node" },
 *           "win32-x64":    { pkg: "core-win32-x64-msvc", file: "core.win32-x64-msvc.node" },
 *         },
 *         exports: ["Renderer", "OutputFormat"],
 *       },
 *     ]),
 *   ],
 * });
 * ```
 */
export function lazyLoadBindings(configs: NativeBindingConfig[]): Plugin[] {
  // Pre-compute virtual module IDs and generated code at config time.
  const entries = configs.map((config) => {
    const virtualId = `\0runtime-binding:${config.package}`;
    const version = readPackageVersion(config.package);
    const code = buildRuntimeLoader({
      scope: config.scope,
      version,
      bindings: config.bindings,
      exports: config.exports,
      label: config.package,
    });

    return { ...config, virtualId, code };
  });

  const resolverPlugin: Plugin = {
    name: "lazy-load-bindings",
    apply: "build",
    enforce: "pre",

    resolveId(source, importer) {
      for (const entry of entries) {
        if (source !== entry.source) continue;
        if (entry.importer && !importer?.includes(entry.importer)) continue;
        return entry.virtualId;
      }
    },

    load(id) {
      for (const entry of entries) {
        if (id === entry.virtualId) return entry.code;
      }
    },
  };

  let outDir = "";
  let isWatch = false;

  const cleanupPlugin: Plugin = {
    name: "lazy-load-bindings-cleanup",
    apply: "build",
    enforce: "post",

    configResolved(config: ResolvedConfig) {
      outDir = resolve(config.root, config.build.outDir);
      isWatch = !!config.build.watch;
    },

    writeBundle() {
      if (isWatch) return;

      for (const file of readdirSync(outDir)) {
        if (file.endsWith(".node")) {
          unlinkSync(join(outDir, file));
          console.log(
            `[lazy-load-bindings] Removed bundled ${file} (will be downloaded at runtime)`,
          );
        }
      }
    },
  };

  return [resolverPlugin, cleanupPlugin];
}
