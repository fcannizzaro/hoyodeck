import path from "node:path";
import url from "node:url";
import { copyFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import { swc } from "rollup-plugin-swc3";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const uuid = "com.fcannizzaro.hoyodeck";
const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = `${uuid}.sdPlugin`;

// ─── Native addon packages to externalize and copy ─────────────────

const NATIVE_PACKAGES = [
  "@fcannizzaro/native-window",
  "@fcannizzaro/native-window-darwin-arm64",
  "@fcannizzaro/native-window-win32-x64-msvc",
];

/**
 * Resolve the root directory of an npm package, or null if not installed.
 * Walks up from the resolved entry point to find the directory containing
 * the package's own package.json (handles packages with nested entry points
 * like "exports": { ".": "./dist/index.js" }).
 */
function resolvePackageDir(pkg) {
  try {
    let dir = path.dirname(
      import.meta.resolve(pkg).replace("file://", ""),
    );
    // Walk up until we find the package root (package.json with matching name)
    while (dir !== path.dirname(dir)) {
      try {
        const json = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf-8"));
        if (json.name === pkg) return dir;
      } catch {}
      dir = path.dirname(dir);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Recursively copy a package's relevant files into the sdPlugin output
 * node_modules, preserving directory structure (e.g. dist/).
 */
function copyPackageToOutput(pkg, outputDir) {
  const srcDir = resolvePackageDir(pkg);
  if (!srcDir) return;

  const destDir = path.join(outputDir, "bin", "node_modules", pkg);

  function copyDir(src, dest) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") {
          copyDir(path.join(src, entry.name), path.join(dest, entry.name));
        }
      } else if (
        entry.name.endsWith(".js") ||
        entry.name.endsWith(".node") ||
        entry.name.endsWith(".d.ts") ||
        entry.name === "package.json"
      ) {
        copyFileSync(path.join(src, entry.name), path.join(dest, entry.name));
      }
    }
  }

  copyDir(srcDir, destDir);
}

export default {
  input: "src/plugin.ts",
  output: {
    file: `${sdPlugin}/bin/plugin.js`,
    format: "cjs",
    sourcemap: true,
    sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
      return url.pathToFileURL(
        path.resolve(path.dirname(sourcemapPath), relativeSourcePath),
      ).href;
    },
  },
  external: [/^@fcannizzaro\/native-window/],
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        __DEBUG__: process.env.DEBUG === "1" ? "true" : "false",
      },
    }),
    alias({
      entries: [
        { find: /^@\/(.*)/, replacement: path.resolve(__dirname, "src/$1") },
      ],
    }),
    swc({
      minify: !isWatching,
      sourceMaps: isWatching,
      jsc: {
        parser: {
          decorators: true,
        },
      },
    }),
    json(),
    resolve({
      browser: false,
      exportConditions: ["node"],
      preferBuiltins: true,
    }),
    commonjs(),
    {
      name: "emit-module-package-file",
      generateBundle() {
        this.emitFile({
          fileName: "package.json",
          source: JSON.stringify({
            main: "plugin.js",
          }),
          type: "asset",
        });
      },
    },
    {
      name: "copy-native-addons",
      writeBundle() {
        for (const pkg of NATIVE_PACKAGES) {
          copyPackageToOutput(pkg, sdPlugin);
        }
      },
    },
  ],
};
