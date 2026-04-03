# Plugin Setup

For brand new projects, prefer `npm create streamdeck-react@latest` and customize the generated scaffold before hand-writing setup files.

## createPlugin(config)

Creates the plugin runtime. Must be called once in your entry file.

```ts
import { createPlugin } from '@fcannizzaro/streamdeck-react';

const plugin = createPlugin({
  fonts: [...],
  actions: [...],
});

await plugin.connect();
```

### PluginConfig

```ts
interface PluginConfig {
  adapter?: StreamDeckAdapter; // Default: physicalDevice()
  fonts: FontConfig[];
  actions: ActionDefinition[];
  wrapper?: WrapperComponent;
  takumi?: TakumiBackend; // Default: "native-binding"
  imageFormat?: "png" | "webp"; // Default: 'png'
  caching?: boolean; // Default: true
  devicePixelRatio?: number; // Default: 1
  onActionError?: (uuid: string, actionId: string, error: Error) => void;
  devtools?: boolean; // Default: false
  debug?: boolean; // Default: NODE_ENV !== 'production'
  imageCacheMaxBytes?: number; // Default: 16777216 (16 MB)
  touchStripCacheMaxBytes?: number; // Default: 8388608 (8 MB)
  useWorker?: boolean; // Default: true (force-disabled when takumi is "wasm")
}
```

| Field                     | Required | Description                                                                                            |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `adapter`                 | No       | Stream Deck adapter. Defaults to `physicalDevice()` (Elgato SDK). See [adapter reference](adapter.md). |
| `fonts`                   | Yes      | At least one font file. See FontConfig below.                                                          |
| `actions`                 | Yes      | Array of action definitions from `defineAction()`.                                                     |
| `wrapper`                 | No       | Component that wraps ALL action roots. Use for global providers.                                       |
| `takumi`                  | No       | Renderer backend: `"native-binding"` (default) or `"wasm"`. WASM mode disables workers and WOFF fonts.|
| `imageFormat`             | No       | Output format. PNG is default and most compatible.                                                     |
| `caching`                 | No       | Output hash caching (xxHash-wasm) to skip duplicate `setImage()` calls.                                |
| `devicePixelRatio`        | No       | Device pixel ratio used by the Takumi renderer. Default: `1`.                                          |
| `onActionError`           | No       | Called when a component throws in any action root.                                                     |
| `devtools`                | No       | Enable the devtools server. Port derived from plugin UUID (39400-39499).                               |
| `debug`                   | No       | Enable render counters, duplicate detection, and depth warnings. Defaults to non-production.           |
| `imageCacheMaxBytes`      | No       | Max bytes for the key/dial image cache (LRU). Set to 0 to disable. Default: 16 MB.                     |
| `touchStripCacheMaxBytes` | No       | Max bytes for the TouchStrip raw buffer cache (LRU). Set to 0 to disable. Default: 8 MB.               |
| `useWorker`               | No       | Offload Takumi rendering to a worker thread. Transparent fallback if worker fails. Force-disabled when `takumi` is `"wasm"`. |

### Plugin-Level Wrapper

Wraps every action root. Use for global state providers:

```tsx
const plugin = createPlugin({
  fonts: [...],
  actions: [...],
  wrapper: ({ children }) => <MyGlobalProvider>{children}</MyGlobalProvider>,
});
```

### connect()

Must be called after `createPlugin()` and must be the last call in the entry file. It calls `adapter.connect()` to establish the connection with the Stream Deck backend (or custom adapter).

Action registration, font initialization, renderer setup, and global settings loading all happen during the `createPlugin()` call itself -- `connect()` only opens the connection.

## defineAction(config)

Maps a manifest UUID to React components.

```ts
import { defineAction } from "@fcannizzaro/streamdeck-react";

export const myAction = defineAction({
  uuid: "com.example.plugin.my-action",
  key: MyKeyComponent,
  info: {
    name: "My Action",
    icon: "imgs/actions/my-action",
  },
});
```

### ActionConfig

```ts
interface ActionConfig<S extends JsonObject = JsonObject> {
  uuid: string;
  key?: ComponentType;
  dial?: ComponentType;
  touchStrip?: ComponentType;
  dialLayout?: EncoderLayout;
  wrapper?: WrapperComponent;
  defaultSettings?: Partial<S>;
  info?: ActionManifestInfo;
}
```

| Field             | Required | Description                                                                                                                   |
| ----------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `uuid`            | Yes      | Must start with the plugin UUID prefix (e.g., `"com.example.plugin."`).                                                      |
| `key`             | No       | Component for key (Keypad controller).                                                                                        |
| `dial`            | No       | Component for encoder display (Stream Deck+). Falls back to `key` if not provided.                                            |
| `touchStrip`      | No       | Full-strip TouchStrip component. Replaces per-encoder `dial` with a single shared React tree spanning the entire touch strip. |
| `dialLayout`      | No       | Encoder feedback layout. Defaults to a full-width canvas `pixmap` layout keyed as `canvas`.                                   |
| `wrapper`         | No       | Component that wraps this action's root (nested inside plugin wrapper).                                                       |
| `defaultSettings` | No       | Default settings shallow-merged with stored settings.                                                                         |
| `info`            | No*      | Action manifest metadata. Required for manifest generation. See ActionManifestInfo below.                                     |

*`info` is optional at the type level but required if you want the action included in the auto-generated `manifest.json`.

### ActionManifestInfo

```ts
interface ActionManifestInfo {
  name: string;         // Action display name in Stream Deck's action list
  icon: string;         // Path to action icon (extension omitted)
  disabled?: boolean;   // Skip this action from manifest generation
  tooltip?: string;     // Hover tooltip in the actions list
  states?: ManifestStateInfo[];  // Custom states (defaults to [{ image: icon }])
  encoder?: ManifestEncoderInfo; // Encoder config (layout, triggerDescription)
  disableAutomaticStates?: boolean;
  disableCaching?: boolean;
  supportedInMultiActions?: boolean;
  supportedInKeyLogicActions?: boolean;
  visibleInActionsList?: boolean;
  userTitleEnabled?: boolean;
  propertyInspectorPath?: string;
  supportUrl?: string;
  os?: ("mac" | "windows")[];
  controllers?: [ManifestController, ManifestController?]; // Auto-derived, rarely needed
}
```

### Encoder Info

For encoder actions, define `info.encoder` for the touch display layout and trigger descriptions:

```tsx
export const volumeAction = defineAction({
  uuid: "com.example.plugin.volume",
  dial: VolumeDial,
  info: {
    name: "Volume",
    icon: "imgs/actions/volume",
    encoder: {
      layout: "$A0",
      triggerDescription: {
        rotate: "Adjust volume",
        push: "Mute / Unmute",
      },
    },
  },
});
```

Controllers are auto-derived from the action's components:
- `key` present → includes `"Keypad"`
- `dial` or `touchStrip` present → includes `"Encoder"`
- Both → `["Keypad", "Encoder"]`
- Neither → defaults to `["Keypad"]`

### Typed Settings

Pass a type parameter for type-safe settings:

```tsx
type VolumeSettings = { volume: number; muted: boolean };

export const volumeAction = defineAction<VolumeSettings>({
  uuid: "com.example.plugin.volume",
  key: VolumeKey,
  dial: VolumeDial,
  dialLayout: "$A1",
  defaultSettings: { volume: 50, muted: false },
});

// In components:
const [settings, setSettings] = useSettings<VolumeSettings>();
```

## FontConfig

```ts
interface FontConfig {
  name: string;
  data: ArrayBuffer | Buffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal" | "italic";
}
```

### Loading Fonts

The recommended approach is to use `googleFont()` which downloads TTF fonts directly from Google Fonts and caches them to `.google-fonts/` on disk. No npm font package needed.

```ts
import { createPlugin, googleFont } from "@fcannizzaro/streamdeck-react";

const inter = await googleFont("Inter");

const plugin = createPlugin({
  fonts: [inter],
  actions: [...],
});
```

For multiple weights:

```ts
const fonts = await googleFont("Inter", [
  { weight: 400 },
  { weight: 700 },
]);
```

You can also load fonts manually via `readFile` if needed:

```ts
import { readFile } from "node:fs/promises";

const fonts: FontConfig[] = [
  {
    name: "Inter",
    data: await readFile("./fonts/Inter-Regular.ttf"),
    weight: 400,
    style: "normal",
  },
];
```

### Font Rules

- At least one font is required in `createPlugin()`.
- Supported formats depend on the backend:
  - **Native binding** (default): `.ttf`, `.otf`, `.woff`, `.woff2`
  - **WASM**: `.ttf`, `.otf` only (WOFF/WOFF2 not supported)
- The renderer cannot access system fonts. Every font used must be explicitly loaded.
- Font is matched by `fontFamily`, `fontWeight`, and `fontStyle`. If the requested weight isn't loaded, the nearest available weight is used.
- Each font weight/style is a separate file. Minimize variants to reduce bundle size.

## Manifest Generation

`manifest.json` is **auto-generated** during the build. No hand-written manifest is needed.

- **Plugin info** comes from the bundler plugin's `manifest` option.
- **Action info** is auto-extracted from `defineAction({ info })` calls in your source code.
- **Controllers** are auto-derived from key/dial/touchStrip presence.
- **Defaults** are applied for OS, Nodejs, SDKVersion, Software, CodePath, Category, States.

Critical rules:

1. **UUID prefix**: Every action's `uuid` must start with the plugin UUID (e.g., `"com.example.plugin."` prefix).
2. **info required**: Each `defineAction()` must have `info: { name, icon }` for manifest generation.
3. **Encoder block**: Encoder actions need `info.encoder` with layout and triggerDescription.
4. **disabled flag**: Set `info.disabled: true` to exclude an action from the manifest while keeping it functional at runtime.

## Context Provider Tree

Every action root is automatically wrapped:

```
ActionProvider
  DeviceProvider
    CanvasProvider
      EventBusProvider
        StreamDeckProvider
          GlobalSettingsProvider
            SettingsProvider
              PluginWrapper (if set)
                ActionWrapper (if set)
                  <YourComponent />
```

All context values except settings are set once on mount and are immutable.
