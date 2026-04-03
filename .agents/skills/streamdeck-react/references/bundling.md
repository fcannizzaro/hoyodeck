# Bundling

`@fcannizzaro/streamdeck-react` supports two bundlers:

- **Rollup** (stable) via `@fcannizzaro/streamdeck-react/rollup` -- provides `streamDeckReact()`
- **Vite 8 with Rolldown** (beta) via `@fcannizzaro/streamdeck-react/vite` -- provides `streamDeckReact()`

If the user is starting from scratch, prefer `npm create streamdeck-react@latest` and let the scaffolder generate the config.

## Rollup Config Templates

### Default (esbuild)

```js
// rollup.config.mjs
import { builtinModules } from "node:module";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import esbuild from "rollup-plugin-esbuild";
import { streamDeckReact } from "@fcannizzaro/streamdeck-react/rollup";

const PLUGIN_DIR = "com.example.my-plugin.sdPlugin";
const builtins = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));

export default {
  input: "src/plugin.ts",
  output: {
    file: `${PLUGIN_DIR}/bin/plugin.mjs`,
    format: "es",
    sourcemap: true,
    inlineDynamicImports: true,
  },
  external: (id) => builtins.has(id),
  plugins: [
    resolve({ preferBuiltins: true }),
    commonjs(),
    json(),
    esbuild({ target: "node20", jsx: "automatic" }),
    streamDeckReact({
      targets: [{ platform: "darwin", arch: "arm64" }],
      manifest: {
        uuid: "com.example.my-plugin",
        name: "My Plugin",
        author: "Your Name",
        description: "A Stream Deck plugin.",
        icon: "imgs/plugin-icon",
        version: "0.0.0.1",
      },
    }),
  ],
};
```

### With React Compiler

When the user opts into React Compiler during scaffolding (`--react-compiler true`), esbuild is replaced by Babel with `babel-plugin-react-compiler`. The compiler automatically memoizes components at build time, preventing unnecessary re-renders and the expensive rasterization pipeline they trigger.

```js
// rollup.config.mjs
import { builtinModules } from "node:module";
import { babel } from "@rollup/plugin-babel";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { streamDeckReact } from "@fcannizzaro/streamdeck-react/rollup";

const PLUGIN_DIR = "com.example.my-plugin.sdPlugin";
const builtins = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));

export default {
  input: "src/plugin.ts",
  output: {
    file: `${PLUGIN_DIR}/bin/plugin.mjs`,
    format: "es",
    sourcemap: true,
    inlineDynamicImports: true,
  },
  external: (id) => builtins.has(id),
  plugins: [
    resolve({ preferBuiltins: true }),
    commonjs(),
    json(),
    babel({
      babelHelpers: "bundled",
      extensions: [".js", ".jsx", ".ts", ".tsx"],
      exclude: "**/node_modules/**",
      plugins: ["babel-plugin-react-compiler"],
      presets: ["@babel/preset-typescript", ["@babel/preset-react", { runtime: "automatic" }]],
    }),
    streamDeckReact({
      targets: [{ platform: "darwin", arch: "arm64" }],
      manifest: {
        uuid: "com.example.my-plugin",
        name: "My Plugin",
        author: "Your Name",
        description: "A Stream Deck plugin.",
        icon: "imgs/plugin-icon",
        version: "0.0.0.1",
      },
    }),
  ],
};
```

## Required Build Dependencies

**Default (esbuild)**:

```bash
npm install -D rollup @rollup/plugin-node-resolve @rollup/plugin-commonjs @rollup/plugin-json rollup-plugin-esbuild
```

**With React Compiler** (replaces esbuild):

```bash
npm install -D rollup @rollup/plugin-node-resolve @rollup/plugin-commonjs @rollup/plugin-json @rollup/plugin-babel @babel/core @babel/preset-typescript @babel/preset-react babel-plugin-react-compiler
```

## Required Runtime Dependencies

```bash
npm install @fcannizzaro/streamdeck-react react ws
```

You also need platform-specific Takumi native binding packages so `streamDeckReact({ targets })` can copy the correct `.node` files into your plugin output.

For production builds, always pass explicit `targets`. In watch mode, `streamDeckReact()` can infer the current supported host target.

## Plugin Details

### streamDeckReact()

Handles two build-time concerns:

1. **Native bindings**: Copies the platform-specific `@takumi-rs/core` native binding (`.node` file) into the output directory. Required when using the default `"native-binding"` backend. When `takumi: "wasm"` is set, this is skipped.

2. **Manifest generation**: Auto-generates `manifest.json` from the `manifest` option (plugin info) and `defineAction({ info })` calls (action info extracted via AST analysis at build time).

```ts
type StreamDeckTargetOptions = {
  targets?: Array<{
    platform: "darwin" | "win32";
    arch: "arm64" | "x64";
  }>;
  takumi?: "native-binding" | "wasm";
  manifest?: PluginManifestInfo;
};

interface PluginManifestInfo {
  uuid: string;          // Plugin UUID (reverse-DNS)
  name: string;          // Plugin display name
  author: string;        // Author name
  description: string;   // Plugin description
  icon: string;          // Plugin icon path (extension omitted)
  version: string;       // Plugin version (e.g. "1.0.0.0")
  // Optional overrides (all have sensible defaults):
  category?: string;       // Default: same as name
  categoryIcon?: string;   // Default: same as icon
  url?: string;
  supportUrl?: string;
  codePath?: string;       // Default: derived from bundler output
  os?: [ManifestOSInfo, ManifestOSInfo?];  // Default: mac 13+ & windows 10+
  nodejs?: ManifestNodejsInfo;  // Default: { version: "24" }
  sdkVersion?: 2 | 3;     // Default: 2
  software?: { minimumVersion: string };  // Default: "7.1"
  profiles?: ManifestProfileInfo[];
  applicationsToMonitor?: { mac?: string[]; windows?: string[] };
  defaultWindowSize?: [number, number];
  propertyInspectorPath?: string;
  codePathMac?: string;
  codePathWin?: string;
}
```

The plugin runs during `writeBundle` and:

1. Uses explicit `targets` when provided.
2. In watch mode, can infer the current supported host target.
3. Resolves the corresponding `@takumi-rs/core-*` packages.
4. Copies the `.node` files to the output directory alongside `plugin.mjs`.
5. Throws for missing or unsupported production targets.

### Supported Platforms

| Platform | Architecture | Package                 | File                         |
| -------- | ------------ | ----------------------- | ---------------------------- |
| macOS    | arm64        | `core-darwin-arm64`     | `core.darwin-arm64.node`     |
| macOS    | x64          | `core-darwin-x64`       | `core.darwin-x64.node`       |
| Windows  | x64          | `core-win32-x64-msvc`   | `core.win32-x64-msvc.node`   |
| Windows  | arm64        | `core-win32-arm64-msvc` | `core.win32-arm64-msvc.node` |

The current built-in target map covers macOS and Windows presets.

## Output Structure

After building, the `.sdPlugin/bin/` directory should contain:

```
bin/
  plugin.mjs           # Bundled plugin code
  plugin.mjs.map       # Source map
  core.<platform>.node # Native Takumi binding
```

## Plugin Order

The order of Rollup plugins matters:

**Default (esbuild)**:

1. `resolve({ preferBuiltins: true })` -- Node module resolution
2. `commonjs()` -- CJS to ESM conversion
3. `json()` -- JSON imports
4. `esbuild({ target: 'node20', jsx: 'automatic' })` -- TypeScript/JSX compilation
5. `streamDeckReact({ targets })` -- copies native binaries (conventionally last)

**With React Compiler (Babel)**:

1. `resolve({ preferBuiltins: true })` -- Node module resolution
2. `commonjs()` -- CJS to ESM conversion
3. `json()` -- JSON imports
4. `babel({ ... })` -- React Compiler + TypeScript/JSX compilation (must exclude `node_modules`)
5. `streamDeckReact({ targets })` -- copies native binaries (conventionally last)

## Key Configuration Notes

- **`format: 'es'`** -- ESM output is required for the Stream Deck Node.js runtime.
- **`inlineDynamicImports: true`** -- bundles everything into a single file.
- **`external`** -- Node.js builtins must be externalized (they're available in the runtime).
- **`target: 'node20'`** -- matches the Stream Deck plugin runtime.
- **`jsx: 'automatic'`** -- uses the React JSX transform (no manual `import React`).

## Watch Mode (Development)

```bash
npx rollup -c -w
```

With the Elgato CLI installed, combine with auto-restart:

```bash
bunx --bun rollup -c -w --watch.onEnd="streamdeck restart com.example.my-plugin"
```

---

## Vite 8 Config Templates

### Default (Oxc transforms)

```ts
// vite.config.ts
import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig, esmExternalRequirePlugin } from "vite";
import react from "@vitejs/plugin-react";
import { streamDeckReact } from "@fcannizzaro/streamdeck-react/vite";

const PLUGIN_DIR = "com.example.my-plugin.sdPlugin";
const builtins = builtinModules.flatMap((m) => [m, `node:${m}`]);

export default defineConfig({
  resolve: {
    conditions: ["node"],
  },
  plugins: [
    esmExternalRequirePlugin({ external: builtins }),
    react(),
    streamDeckReact({
      uuid: "com.example.my-plugin",
      targets: [{ platform: "darwin", arch: "arm64" }],
    }),
  ],
  build: {
    target: "node20",
    outDir: resolve(PLUGIN_DIR, "bin"),
    emptyOutDir: false,
    sourcemap: true,
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
```

### With React Compiler

```ts
// vite.config.ts
import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig, esmExternalRequirePlugin } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { streamDeckReact } from "@fcannizzaro/streamdeck-react/vite";

const PLUGIN_DIR = "com.example.my-plugin.sdPlugin";
const builtins = builtinModules.flatMap((m) => [m, `node:${m}`]);

export default defineConfig({
  resolve: {
    conditions: ["node"],
  },
  plugins: [
    esmExternalRequirePlugin({ external: builtins }),
    react(),
    // @ts-expect-error — @rolldown/plugin-babel types incorrectly mark inherited babel fields as required
    await babel({
      presets: [reactCompilerPreset()],
    }),
    streamDeckReact({
      uuid: "com.example.my-plugin",
      targets: [{ platform: "darwin", arch: "arm64" }],
    }),
  ],
  build: {
    target: "node20",
    outDir: resolve(PLUGIN_DIR, "bin"),
    emptyOutDir: false,
    sourcemap: true,
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
```

## Required Vite 8 Build Dependencies

**Default**:

```bash
npm install -D vite@8.0.0 @vitejs/plugin-react@6.0.1
```

**With React Compiler**:

```bash
npm install -D vite@8.0.0 @vitejs/plugin-react@6.0.1 @rolldown/plugin-babel @babel/core babel-plugin-react-compiler
```

## Vite-Specific Notes

- **`resolve.conditions: ['node']`** -- required so packages like `ws` resolve to their Node.js implementation instead of browser stubs.
- **`esmExternalRequirePlugin({ external: builtins })`** -- converts CJS `require()` calls for Node.js builtins to ESM `import` statements. Without this, bundled CJS code (e.g. `ws`) will crash at runtime because `require` is unavailable in ESM.
- **`build.rolldownOptions`** -- replaces the deprecated `build.rollupOptions` in Vite 8.
- **`codeSplitting: false`** -- replaces the deprecated `inlineDynamicImports: true` from Rollup.
- **`streamDeckReact()`** -- combines native binding copying and optional plugin restart into a single plugin. Pass `uuid` to auto-restart after each build.
- **Manifest `Nodejs.Version`** should be `"24"` for all plugins.

## Vite Watch Mode (Development)

```bash
npx vite build --watch
```

The `streamDeckReact({ uuid })` plugin automatically restarts the Stream Deck plugin after each build.
