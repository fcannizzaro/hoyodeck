---
name: lazy-load-bindings
description: >-
  Build Vite plugins for napi-rs native modules that lazy-load platform-specific
  .node binaries from npm at runtime instead of bundling them. Use for: replacing
  bundled native bindings with on-demand download, reducing cross-platform bundle
  size, intercepting napi-rs imports with Vite virtual modules, extracting .node
  files from npm tarballs at runtime, and configuring the lazyLoadBindings plugin.
---

# Lazy-Load Native Bindings for Vite

A pattern and reusable Vite plugin for lazy-loading napi-rs `.node` native
binaries from the npm registry instead of bundling them.  Instead of shipping
every platform's binary in the output bundle, the plugin downloads **only** the
one matching the current `process.platform`/`process.arch` on first use and
caches it on disk.

## When to Use This Skill

Use when the user is:

- Bundling a Node.js project with Vite that depends on napi-rs native modules
- Trying to reduce bundle size by removing cross-platform `.node` binaries
- Asking how to download native bindings at runtime from npm
- Working with packages that follow the napi-rs platform-package convention
- Configuring the `lazyLoadBindings()` Vite plugin in this project
- Adding a new napi-rs dependency and wants it handled the same way

## Background: napi-rs Platform Package Convention

Most Rust-to-Node native addons built with [napi-rs](https://napi.rs) follow a
standard distribution layout:

```
@scope/package              ← main package (JS loader + types)
@scope/package-darwin-arm64 ← macOS ARM64 binary
@scope/package-darwin-x64   ← macOS x64 binary
@scope/package-win32-x64-msvc   ← Windows x64 binary
@scope/package-linux-x64-gnu    ← Linux x64 binary
...
```

The main package lists the platform packages as `optionalDependencies`.  The
package manager installs only the one matching the current OS.  At runtime, a JS
loader file detects `process.platform`/`process.arch` and `require()`s the
correct `.node` binary.

Each platform package is a minimal npm tarball containing:

```
package/
  package.json
  <binary-name>.<platform>-<arch>.node
```

The **problem** arises when you bundle for cross-platform distribution (e.g. a
Stream Deck plugin that ships a single archive for macOS + Windows).  The default
approach copies every platform's `.node` file into the output, wasting space on
binaries the user will never load.

## How the Plugin Solves This

### Build Time (Vite)

Two Vite plugins work together:

1. **`lazy-load-bindings`** (`enforce: "pre"`) — intercepts the native
   module import via `resolveId` and replaces it with a **virtual ES module**
   that contains the download-on-demand logic.

2. **`lazy-load-bindings-cleanup`** (`enforce: "post"`) — removes `.node` files
   from the output directory that other plugins may have copied during their own
   `writeBundle` hooks.  Skipped in watch/dev mode so locally-installed binaries
   act as a cache.

### Runtime (Node.js)

The injected virtual module executes via **top-level `await`** (ESM):

```
Module loads
  → existsSync(nodePath)?
      yes → require() the cached .node file
      no  → fetch npm tarball → gunzipSync → minimal tar parse
            → writeFileSync the .node file → require() it
```

The `.node` file is written next to the bundle output (`import.meta.url`) and
persists across restarts.  Subsequent loads hit the `existsSync` fast path.

## Reference Implementation

The plugin lives at `plugin/vite-plugin-lazy-load-bindings.ts`.

### Config Type

```ts
interface NativeBindingConfig {
  /** Import specifier to intercept. */
  source: string;

  /** Scope the intercept to imports from files whose path includes this string. */
  importer?: string;

  /** Package name to resolve the installed version from. */
  package: string;

  /** npm scope for platform sub-packages (e.g. "@nativewindow"). */
  scope: string;

  /** "platform-arch" → { npm sub-package name, .node filename }. */
  bindings: Record<string, { pkg: string; file: string }>;

  /** Named exports to re-export from the native binding. */
  exports: string[];
}
```

### Usage

```ts
import { lazyLoadBindings } from "./vite-plugin-lazy-load-bindings";

export default defineConfig({
  plugins: [
    ...lazyLoadBindings([ /* configs */ ]),
    // other plugins that may copy .node files (e.g. streamDeckReact)
  ],
});
```

The function returns `Plugin[]` — spread it into the `plugins` array.
`enforce` levels ensure correct ordering regardless of array position.

## Step-by-Step: Adding a New Native Module

### 1. Identify the Import to Intercept

Find where the native binding is loaded.  There are two common patterns:

**Bare specifier** — the package IS the native module:

```ts
import { Renderer } from "@takumi-rs/core";
//                        ^^^^^^^^^^^^^^^^^ intercept this
```

Config:

```ts
{
  source: "@takumi-rs/core",
  // no importer needed — bare specifier is globally unique
}
```

**Relative loader inside a package** — the package has a JS loader that
`import`s or `require`s a sibling file:

```ts
// Inside @nativewindow/webview/dist/index.js:
import { NativeWindow } from "../native-window.js";
//                            ^^^^^^^^^^^^^^^^^^^^ intercept this
```

To find this, look at the package's source: check `dist/index.js` or `index.js`
for any `import`/`require` that references a `.js` or `.node` file containing
platform detection logic.

Config:

```ts
{
  source: "../native-window.js",          // the exact specifier
  importer: "@nativewindow/webview",      // scope to this package
}
```

### 2. Map Platform Packages

Check the main package's `package.json` → `optionalDependencies` to find all
platform sub-packages.  Then build the bindings map:

```ts
bindings: {
  "darwin-arm64": { pkg: "core-darwin-arm64",       file: "core.darwin-arm64.node" },
  "darwin-x64":   { pkg: "core-darwin-x64",         file: "core.darwin-x64.node" },
  "win32-x64":    { pkg: "core-win32-x64-msvc",     file: "core.win32-x64-msvc.node" },
  "win32-arm64":  { pkg: "core-win32-arm64-msvc",   file: "core.win32-arm64-msvc.node" },
  "linux-x64":    { pkg: "core-linux-x64-gnu",      file: "core.linux-x64-gnu.node" },
},
```

The **key** is `"<process.platform>-<process.arch>"`.
The **pkg** is the sub-package name without the scope (appended at runtime).
The **file** is the `.node` filename inside the sub-package tarball.

To verify filenames, inspect any platform package:

```bash
npm view @scope/package-darwin-arm64 dist.tarball
# or download and list:
curl -sL <tarball-url> | tar tzf - 2>/dev/null
```

### 3. List the Exports

Find the named exports from the native binding.  Check the main package's
TypeScript declarations (`.d.ts`) or its `index.js`:

```ts
exports: ["Renderer", "OutputFormat", "DitheringAlgorithm"],
```

These are re-exported verbatim from the virtual module via
`export const { ... } = binding;`.

### 4. Set Package and Scope

- **`package`** — the main npm package name (used to resolve the installed
  version at build time via `import.meta.resolve`).
- **`scope`** — the npm scope prefix for platform packages.  The runtime
  download URL is constructed as:
  `https://registry.npmjs.org/${scope}/${pkg}/-/${pkg}-${version}.tgz`

### 5. Add the Config Entry

```ts
...lazyLoadBindings([
  {
    source: "my-native-lib",
    package: "my-native-lib",
    scope: "@my-scope",
    bindings: {
      "darwin-arm64": { pkg: "lib-darwin-arm64", file: "my-lib.darwin-arm64.node" },
      "win32-x64":    { pkg: "lib-win32-x64-msvc", file: "my-lib.win32-x64-msvc.node" },
    },
    exports: ["MyClass", "myFunction"],
  },
  // ...existing entries
]),
```

### 6. Remove Platform Dependencies from package.json

With runtime download, you no longer need the platform-specific packages
installed at build time.  Keep only the main package (needed for types and
version resolution):

```diff
  "dependencies": {
    "my-native-lib": "^1.0.0",
-   "my-native-lib-darwin-arm64": "^1.0.0",
-   "my-native-lib-win32-x64-msvc": "^1.0.0",
  }
```

## Internals

### Version Resolution

The plugin resolves the installed version at **build time** by calling
`import.meta.resolve(packageName)` to find the entry point, then walking up
the directory tree to find `package.json` with the matching `name` field.  This
bypasses strict `exports` maps that block `require("pkg/package.json")`.

### Virtual Module Code Generation

`buildRuntimeLoader()` produces a self-contained ESM string with:

- `import.meta.url`-relative path resolution (works regardless of where the
  bundle ends up on disk)
- `createRequire` for loading the `.node` file (native addons cannot be loaded
  via `import`)
- `gunzipSync` for decompressing the npm `.tgz` tarball
- A minimal inline tar parser (~15 lines) that scans 512-byte headers to find
  the target `.node` file
- Top-level `await` for the `fetch` call (valid in Node 14.8+ ESM)

### Tar Parser Details

npm tarballs are gzipped tar archives.  The tar format uses fixed 512-byte
headers per file entry:

| Offset | Length | Content                          |
|--------|--------|----------------------------------|
| 0      | 100    | Filename (null-terminated ASCII) |
| 124    | 12     | File size (octal ASCII)          |

After each header, the file data follows, padded to the next 512-byte boundary.
The parser scans headers sequentially until it finds one whose name ends with
the target `.node` filename, extracts that range, and writes it to disk.

### Plugin Enforcement Levels

```
enforce:"pre"   → resolveId / load    (runs BEFORE other plugins)
enforce:"post"  → writeBundle cleanup (runs AFTER other plugins)
```

This ensures:

- The virtual module intercept wins over any other plugin's `resolveId` for the
  same specifier (e.g. `streamDeckReact`'s built-in `@takumi-rs/core` handler).
- The cleanup runs after all other `writeBundle` hooks, catching `.node` files
  that any plugin may have copied.

### Dev/Watch Mode Behavior

When `config.build.watch` is truthy (dev mode), the cleanup plugin **skips**
deletion.  This means `.node` files that other plugins copy from `node_modules`
remain in the output directory.  The virtual module's `existsSync` check finds
them and loads them directly — no download needed during development.

## Troubleshooting

### "Unsupported platform" error at runtime

The `process.platform`-`process.arch` key doesn't exist in the `bindings` map.
Add the missing platform entry.

### "Failed to download native binding (404)"

The npm tarball URL is wrong.  Verify the scope, package name suffix, and
version match what's actually published:

```bash
curl -I "https://registry.npmjs.org/@scope/pkg-name/-/pkg-name-1.0.0.tgz"
```

### ".node file not found in npm tarball"

The `file` value doesn't match the actual filename inside the tarball.  Download
and inspect:

```bash
curl -sL <tarball-url> | tar tzf -
```

### "Could not resolve version"

`import.meta.resolve(packageName)` failed — the main package isn't installed or
its `exports` map has no valid entry point.  Make sure the main package is in
`dependencies` (not just `devDependencies`).

### exports map blocks package.json access

Some packages have strict `exports` that don't expose `./package.json`.  The
plugin handles this automatically by walking up from the resolved entry point.
No action needed — this is already solved.

### Other plugins still copy .node files

The `lazy-load-bindings-cleanup` plugin (enforce: `"post"`) removes them after
the fact.  Ensure `lazyLoadBindings()` is spread into the `plugins` array so
both plugins are registered.  In watch mode, cleanup is intentionally skipped.
