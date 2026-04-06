# Bundling

`@fcannizzaro/streamdeck-react` uses **Vite 8 with Rolldown** via `@fcannizzaro/streamdeck-react/vite` which provides `streamDeckReact()`.

If the user is starting from scratch, prefer `npm create streamdeck-react@latest` and let the scaffolder generate the config.

## Vite Config Templates

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

When the user opts into React Compiler during scaffolding (`--react-compiler true`), the Babel plugin is added on top of the default config. The compiler automatically memoizes components at build time, preventing unnecessary re-renders and the expensive rasterization pipeline they trigger.

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

## Required Build Dependencies

**Default**:

```bash
npm install -D vite@8.0.0 @vitejs/plugin-react@6.0.1
```

**With React Compiler**:

```bash
npm install -D vite@8.0.0 @vitejs/plugin-react@6.0.1 @rolldown/plugin-babel @babel/core babel-plugin-react-compiler
```

## Required Runtime Dependencies

```bash
npm install @fcannizzaro/streamdeck-react react ws
```

## Native Binding Strategy

By default, native Takumi `.node` binaries are **lazy-loaded at runtime**. On first plugin startup, the binary matching the current `process.platform`/`process.arch` is downloaded from npm and cached on disk next to the bundle output. Subsequent loads use the cached file with zero network overhead.

No platform-specific `@takumi-rs/core-*` packages need to be installed. The installed version of the main `@takumi-rs/core` package (included as a dependency) is resolved at build time and baked into the generated loader.

### Lazy Loading Flow

**Build time**:

1. The plugin resolves the installed version of `@takumi-rs/core` (and any `nativeModules` entries) from `package.json` in `node_modules`.
2. A self-contained virtual ESM module is generated for each native module, embedding the version string, npm scope, and platform-to-binding mapping.
3. All imports of the native module are redirected to the virtual loader via `resolveId`.

Version resolution uses three strategies in order:

1. `createRequire` from the Vite project root (resolves workspace-specific deps).
2. `createRequire` from the library's own location (handles hoisted packages).
3. Direct `node_modules` walk (for packages whose `exports` map lacks a `require` condition).

If all strategies fail, the module falls back to copy mode for that specific entry with a build-time warning.

**Runtime (first startup)**:

```
Read .native-versions.json manifest (if exists)
  ↓
existsSync(nodePath) && cachedVersion === VERSION?
  ├── YES → require() cached .node file (~1ms, fast path)
  └── NO  → fetch npm tarball from registry.npmjs.org
            → gunzipSync → inline tar parse (512-byte headers)
            → writeFileSync .node file to disk
            → update .native-versions.json with new version
            → require() the .node file
```

### Version Manifest (`.native-versions.json`)

A JSON file written alongside cached `.node` binaries that tracks their installed versions:

```json
{
  "core.darwin-arm64.node": "0.73.1",
  "native.win32-x64-msvc.node": "1.0.0"
}
```

**Purpose**: cache invalidation on dependency upgrades. When the baked-in `VERSION` (from build time) differs from the cached version in the manifest, the binary is re-downloaded even if the `.node` file exists on disk. Without this, upgrading `@takumi-rs/core` would silently load the old binary.

Each native module only reads/writes its own key. Since Node.js evaluates ESM modules sequentially, concurrent access from multiple native modules is safe.

The filename constant is exported as `NATIVE_VERSIONS_FILENAME` from `@fcannizzaro/streamdeck-react/vite` and the manifest shape as `NativeVersionsManifest`.

### Opting into Copy Mode

To revert to the previous behavior of copying `.node` files from `node_modules` at build time (for air-gapped/offline environments), set `nativeBindings: "copy"` and install the matching platform packages:

```ts
streamDeckReact({
  nativeBindings: "copy",
  targets: [{ platform: "darwin", arch: "arm64" }],
  manifest: { ... },
})
```

```bash
npm install @takumi-rs/core-darwin-arm64
```

Missing bindings are warnings in development mode and errors in production builds.

## Plugin Details

### streamDeckReact()

Handles build-time concerns:

1. **Native bindings**: By default, generates a lazy-loader virtual module that downloads the platform-specific `.node` file from npm at runtime. When `nativeBindings: "copy"`, copies binaries from `node_modules` instead (requires `targets`). When `takumi: "wasm"`, skipped entirely. Additional native modules can be registered via `nativeModules`.

2. **Manifest generation**: Auto-generates `manifest.json` from the `manifest` option (plugin info) and `defineAction({ info })` calls (action info extracted via AST analysis at build time).

```ts
type StreamDeckReactOptions = {
  targets?: Array<{
    platform: "darwin" | "win32";
    arch: "arm64" | "x64";
  }>;
  takumi?: "native-binding" | "wasm";
  nativeBindings?: "lazy" | "copy"; // Default: "lazy"
  nativeModules?: NativeModuleConfig[]; // Default: []
  manifest?: PluginManifestInfo;
  uuid?: string;
};

interface NativeModuleConfig {
  importSpecifier: string; // npm package to intercept (e.g., "@mypkg/native-core")
  scope?: string; // npm scope for platform packages (auto-inferred from scoped specifiers)
  bindings: Record<string, { pkg: string; file: string }>; // platform-arch → { pkg, file }
  exports: string[]; // Named exports to re-export from the binding
  version?: string; // Explicit version (auto-resolved when omitted)
}

interface PluginManifestInfo {
  uuid: string; // Plugin UUID (reverse-DNS)
  name: string; // Plugin display name
  author: string; // Author name
  description: string; // Plugin description
  icon: string; // Plugin icon path (extension omitted)
  version: string; // Plugin version (e.g. "1.0.0.0")
  // Optional overrides (all have sensible defaults):
  category?: string; // Default: same as name
  categoryIcon?: string; // Default: same as icon
  url?: string;
  supportUrl?: string;
  codePath?: string; // Default: derived from bundler output
  os?: [ManifestOSInfo, ManifestOSInfo?]; // Default: mac 13+ & windows 10+
  nodejs?: ManifestNodejsInfo; // Default: { version: "24" }
  sdkVersion?: 2 | 3; // Default: 2
  software?: { minimumVersion: string }; // Default: "7.1"
  profiles?: ManifestProfileInfo[];
  applicationsToMonitor?: { mac?: string[]; windows?: string[] };
  defaultWindowSize?: [number, number];
  propertyInspectorPath?: string;
  codePathMac?: string;
  codePathWin?: string;
}
```

The plugin runs during the build and:

1. In lazy mode (default): resolves the installed `@takumi-rs/core` version and generates a virtual module with download-on-demand logic. At runtime, the `.node` file is fetched from npm, extracted from the tarball, and cached. The same mechanism applies to any user-provided `nativeModules`.
2. In copy mode (`nativeBindings: "copy"`): uses explicit `targets` to locate and copy `.node` files from `node_modules` for all registered native modules.
3. Generates `manifest.json` from the `manifest` option and extracted action metadata.
4. Throws for missing bindings in copy mode production builds.

### Custom Native Modules

The `nativeModules` option lets you register additional NAPI-RS (or other native `.node`) packages that should receive the same lazy-download or build-time copy treatment as the built-in Takumi binding.

```ts
streamDeckReact({
  manifest: {
    /* ... */
  },
  nativeModules: [
    {
      importSpecifier: "@mypkg/native-core",
      // scope auto-inferred as "@mypkg" from importSpecifier
      bindings: {
        "darwin-arm64": { pkg: "native-core-darwin-arm64", file: "native.darwin-arm64.node" },
        "darwin-x64": { pkg: "native-core-darwin-x64", file: "native.darwin-x64.node" },
        "win32-x64": { pkg: "native-core-win32-x64", file: "native.win32-x64-msvc.node" },
      },
      exports: ["MyClass", "helperFn"],
    },
  ],
});
```

How it works:

- At build time, the plugin resolves each module's installed version (or uses the explicit `version` field) and generates a virtual module.
- In lazy mode: the generated virtual module downloads the platform-specific `.node` binary from npm on first use and caches it on disk.
- In copy mode: `.node` files are copied from `node_modules` to the output directory during `writeBundle`.
- Each module's `importSpecifier` is intercepted by the bundler's `resolveId` hook and replaced with the generated virtual loader.
- The `scope` field is optional — when omitted, it's auto-inferred from scoped package names (e.g., `"@mypkg/foo"` → `"@mypkg"`).

Validation rules:

- `exports` and `bindings` must not be empty.
- `importSpecifier` must be unique across all entries.
- `"@takumi-rs/core"` cannot be added to `nativeModules` (it's managed via the `takumi` option).
- `.node` filenames must be unique across all native modules (including Takumi).

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
```

When using `nativeBindings: "copy"`, the output also includes:

```
bin/
  core.<platform>.node # Native Takumi binding (copy mode only)
```

With the default lazy mode, the `.node` file appears after the plugin's first startup (downloaded and cached automatically).

## Key Configuration Notes

- **`resolve.conditions: ['node']`** -- required so packages like `ws` resolve to their Node.js implementation instead of browser stubs.
- **`esmExternalRequirePlugin({ external: builtins })`** -- converts CJS `require()` calls for Node.js builtins to ESM `import` statements. Without this, bundled CJS code (e.g. `ws`) will crash at runtime because `require` is unavailable in ESM.
- **`build.rolldownOptions`** -- Rolldown-specific output configuration.
- **`codeSplitting: false`** -- bundles everything into a single file.
- **`streamDeckReact()`** -- handles native binding loading (lazy by default) and optional plugin restart. Pass `uuid` to auto-restart after each build.
- **Manifest `Nodejs.Version`** should be `"24"` for all plugins.

## Watch Mode (Development)

```bash
npx vite build --watch
```

The `streamDeckReact({ uuid })` plugin automatically restarts the Stream Deck plugin after each build.
