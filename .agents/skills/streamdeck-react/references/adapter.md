# Adapter Layer

The adapter layer abstracts the `@elgato/streamdeck` SDK behind a pluggable `StreamDeckAdapter` interface. This makes the SDK an optional peer dependency and enables alternative backends (web simulator, test harness).

## Key Concepts

- `physicalDevice()` is the default adapter wrapping the real Elgato SDK. It is the **only** module that value-imports from `@elgato/streamdeck`.
- `StreamDeckAdapter` is the main contract any backend must implement.
- `AdapterActionHandle` is a flat interface unifying Key/Dial/Action. Inapplicable methods (e.g., `setImage` on dial) no-op.
- `AdapterActionCallbacks` defines the event callbacks the library provides when registering an action. The adapter invokes them when events fire.
- All hooks (`useOpenUrl`, `useSwitchProfile`, `useSendToPI`, `useShowAlert`, `useShowOk`, `useTitle`, `useDialHint`) route through the adapter.

## Event Flow

```
Backend (SDK, WebSocket, etc.)
  ↓ fires event
AdapterActionCallbacks.onKeyDown(actionId, payload)
  ↓ library routes to
registry.dispatch(actionId, "keyDown", payload)
  ↓
EventBus → useKeyDown() hook in user component
```

## StreamDeckAdapter Interface

```ts
interface StreamDeckAdapter {
  readonly pluginUUID: string;
  connect(): Promise<void>;
  getGlobalSettings<T extends JsonObject>(): Promise<T>;
  setGlobalSettings<T extends JsonObject>(settings: T): Promise<void>;
  onGlobalSettingsChanged(callback: (settings: JsonObject) => void): void;
  registerAction(uuid: string, callbacks: AdapterActionCallbacks): void;
  openUrl(url: string): Promise<void>;
  switchToProfile(deviceId: string, profile: string): Promise<void>;
  sendToPropertyInspector(payload: JsonValue): Promise<void>;
}
```

## AdapterActionHandle Interface

```ts
interface AdapterActionHandle {
  readonly id: string;
  readonly device: AdapterActionDevice;
  readonly controllerType: AdapterController;
  readonly coordinates?: AdapterCoordinates;

  // Key operations (no-op on encoder surfaces)
  setImage(dataUri: string): Promise<void>;
  setTitle(title: string): Promise<void>;
  showOk(): Promise<void>;

  // Shared operations
  showAlert(): Promise<void>;
  setSettings(settings: JsonObject): Promise<void>;

  // Encoder operations (no-op on key surfaces)
  setFeedback(payload: Record<string, unknown>): Promise<void>;
  setFeedbackLayout(layout: string | Record<string, unknown>): Promise<void>;
  setTriggerDescription(hints: AdapterTriggerDescription): Promise<void>;
}
```

## AdapterActionCallbacks Interface

```ts
interface AdapterActionCallbacks {
  onWillAppear(ev: AdapterWillAppearEvent): void;
  onWillDisappear(actionId: string): void;
  onKeyDown(actionId: string, payload: AdapterKeyDownPayload): void;
  onKeyUp(actionId: string, payload: AdapterKeyUpPayload): void;
  onDialRotate(actionId: string, payload: AdapterDialRotatePayload): void;
  onDialDown(actionId: string, payload: AdapterDialPressPayload): void;
  onDialUp(actionId: string, payload: AdapterDialPressPayload): void;
  onTouchTap(actionId: string, payload: AdapterTouchTapPayload): void;
  onDidReceiveSettings(actionId: string, settings: JsonObject): void;
  onSendToPlugin(actionId: string, payload: JsonValue): void;
  onPropertyInspectorDidAppear(actionId: string): void;
  onPropertyInspectorDidDisappear(actionId: string): void;
  onTitleParametersDidChange(
    actionId: string,
    payload: { title: string; settings: JsonObject },
  ): void;
}
```

## Primitive Types

```ts
type AdapterController = "Keypad" | "Encoder";

interface AdapterCoordinates {
  readonly column: number;
  readonly row: number;
}

interface AdapterSize {
  readonly columns: number;
  readonly rows: number;
}

interface AdapterTriggerDescription {
  rotate?: string;
  push?: string;
  touch?: string;
  longTouch?: string;
}

interface AdapterActionDevice {
  readonly id: string;
  readonly type: number; // Numeric Elgato DeviceType
  readonly size: AdapterSize;
  readonly name: string;
}
```

## AdapterWillAppearEvent

```ts
interface AdapterWillAppearEvent {
  action: AdapterActionHandle;
  payload: {
    settings: JsonObject;
    controller: AdapterController;
    isInMultiAction: boolean;
  };
}
```

## Usage: Default (Physical Device)

```ts
import { createPlugin, physicalDevice } from "@fcannizzaro/streamdeck-react";

const plugin = createPlugin({
  adapter: physicalDevice(), // explicit, or omit for same default
  fonts: [...],
  actions: [...],
});

await plugin.connect();
```

## Usage: Custom Adapter

Implement `StreamDeckAdapter` and pass it to `createPlugin()`:

```ts
import type { StreamDeckAdapter, AdapterActionCallbacks } from "@fcannizzaro/streamdeck-react";

function myWebSimulator(): StreamDeckAdapter {
  const actionCallbackMap = new Map<string, AdapterActionCallbacks>();

  return {
    pluginUUID: "com.example.my-plugin",

    async connect() {
      // Set up WebSocket, HTTP, etc.
    },

    async getGlobalSettings() {
      return {};
    },

    async setGlobalSettings(settings) {
      // Persist settings
    },

    onGlobalSettingsChanged(callback) {
      // Subscribe to external changes
    },

    registerAction(uuid, callbacks) {
      actionCallbackMap.set(uuid, callbacks);
      // Wire to your event source
    },

    async openUrl(url) {
      window.open(url, "_blank");
    },

    async switchToProfile() {},
    async sendToPropertyInspector() {},
  };
}
```

To fire events from your backend, invoke the registered callbacks:

```ts
// When a key is pressed in the simulator:
const callbacks = actionCallbackMap.get("com.example.my-action");
callbacks?.onKeyDown("action-instance-id", {
  settings: {},
  isInMultiAction: false,
  state: 0,
});
```

## SDK Isolation

Only `src/adapter/physical-device.ts` imports from `@elgato/streamdeck`. All other modules use adapter types from `src/adapter/types.ts`. This means:

- `@elgato/streamdeck` is an optional peer dependency.
- Custom adapter users don't need the SDK installed.
- SDK types (`Action`, `DialAction`, `KeyAction`, `SingletonAction`) never appear in the public API.

## PluginConfig.adapter

The `adapter` field in `PluginConfig` is optional. When omitted, it defaults to `physicalDevice()`.

```ts
interface PluginConfig {
  adapter?: StreamDeckAdapter; // Default: physicalDevice()
  fonts: FontConfig[];
  actions: ActionDefinition[];
  // ...other options
}
```

## Exports

All adapter types are exported from the main entry point:

```ts
// Value export
export { physicalDevice } from "@fcannizzaro/streamdeck-react";

// Type exports
export type {
  StreamDeckAdapter,
  AdapterActionHandle,
  AdapterActionCallbacks,
  AdapterWillAppearEvent,
  AdapterActionDevice,
  AdapterController,
  AdapterCoordinates,
  AdapterSize,
  AdapterTriggerDescription,
} from "@fcannizzaro/streamdeck-react";
```
