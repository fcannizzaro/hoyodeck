# Hooks

Complete reference for all hooks exported by `@fcannizzaro/streamdeck-react`.

## Event Hooks

All event hooks subscribe to the root's EventBus via `useEffect` and use a stable callback ref to avoid stale closures.

### useKeyDown

Fires when a key is pressed down.

```ts
function useKeyDown(callback: (payload: KeyDownPayload) => void): void;

interface KeyDownPayload {
  settings: JsonObject;
  isInMultiAction: boolean;
  state?: number;
  userDesiredState?: number;
}
```

### useKeyUp

Fires when a key is released.

```ts
function useKeyUp(callback: (payload: KeyUpPayload) => void): void;

interface KeyUpPayload {
  settings: JsonObject;
  isInMultiAction: boolean;
  state?: number;
  userDesiredState?: number;
}
```

### useDialRotate

Fires when a dial/encoder is rotated.

```ts
function useDialRotate(callback: (payload: DialRotatePayload) => void): void;

interface DialRotatePayload {
  ticks: number; // Positive = clockwise, negative = counter-clockwise
  pressed: boolean; // Whether the dial is pressed while rotating
  settings: JsonObject;
}
```

### useDialDown / useDialUp

Fire when a dial is pressed / released.

```ts
function useDialDown(callback: (payload: DialPressPayload) => void): void;
function useDialUp(callback: (payload: DialPressPayload) => void): void;

interface DialPressPayload {
  settings: JsonObject;
  controller: "Encoder";
}
```

### useTouchTap

Fires when the touch strip is tapped.

```ts
function useTouchTap(callback: (payload: TouchTapPayload) => void): void;

interface TouchTapPayload {
  tapPos: [x: number, y: number]; // Tap coordinates
  hold: boolean; // Whether it was a long press
  settings: JsonObject;
}
```

### useDialHint

Sets the encoder trigger descriptions shown on Stream Deck+. Updates automatically when hint values change. Calls `action.setTriggerDescription()` under the hood.

```ts
function useDialHint(hints: DialHints): void;

interface DialHints {
  rotate?: string;
  press?: string;
  touch?: string;
  longTouch?: string;
}
```

Example:

```tsx
function VolumeDial() {
  const [muted, setMuted] = useState(false);

  useDialHint({
    rotate: "Adjust volume",
    press: muted ? "Unmute" : "Mute",
  });

  // ...
}
```

## Gesture Hooks

Higher-level interaction hooks built on top of key events. They handle timing and state tracking internally via the root's EventBus.

### useTap

Fires on a single `keyUp`. When `useDoubleTap` is also active for the same action, `useTap` is automatically delayed until the double-tap window expires -- and cancelled if a double-tap fires. When used alone, it fires immediately.

```ts
function useTap(callback: (payload: KeyUpPayload) => void, options?: TapOptions): void;

interface TapOptions {
  /** Timeout override for the gated delay (inherits from useDoubleTap when omitted). */
  timeout?: number;
}
```

### useLongPress

Fires when a key is held down for at least `timeout` ms. If the key is released before the timeout, the callback is not invoked.

```ts
function useLongPress(
  callback: (payload: KeyDownPayload) => void,
  options?: LongPressOptions,
): void;

interface LongPressOptions {
  /** Milliseconds the key must be held before firing. @default 500 */
  timeout?: number;
}
```

### useDoubleTap

Fires when two `keyUp` events occur within `timeout` ms of each other. A triple-tap triggers once on the second tap; the third tap starts a new pair.

When `useTap` is also active, `useDoubleTap` registers a gate so that single-tap callbacks are delayed and can be cancelled on double-tap.

```ts
function useDoubleTap(callback: (payload: KeyUpPayload) => void, options?: DoubleTapOptions): void;

interface DoubleTapOptions {
  /** Max milliseconds between two key-up events. @default 250 */
  timeout?: number;
}
```

### Combining useTap and useDoubleTap

When both hooks are used in the same action, they coordinate automatically via an internal per-action TapGate. No extra configuration is needed:

```tsx
function ModeKey() {
  const [label, setLabel] = useState("READY");

  useTap(() => setLabel("SINGLE"));
  useDoubleTap(() => setLabel("DOUBLE"));

  return (
    <div className="flex items-center justify-center w-full h-full bg-[#1a1a1a]">
      <span className="text-white text-[16px]">{label}</span>
    </div>
  );
}
```

## Settings Hooks

### useSettings

Returns `[settings, setSettings]` with shallow-merge semantics. Bidirectional sync with the Stream Deck SDK.

```ts
function useSettings<S extends JsonObject = JsonObject>(): [S, (partial: Partial<S>) => void];
```

**Merge semantics**: `setSettings` does `{ ...current, ...partial }` -- always merges, never replaces. This matches the SDK's `setSettings` behavior.

**Sync flow**:

1. **React to SDK**: calling `setSettings({ count: 5 })` updates React state (triggers re-render) AND calls `action.setSettings()` to persist.
2. **SDK to React**: Property Inspector settings changes (`onDidReceiveSettings`) update internal state and re-render components using `useSettings()`.
3. **Conflict resolution**: the SDK is source of truth. Last write wins.

### useGlobalSettings

Same pattern as `useSettings`, but for plugin-wide global settings shared across all action instances.

```ts
function useGlobalSettings<G extends JsonObject = JsonObject>(): [G, (partial: Partial<G>) => void];
```

## Lifecycle Hooks

### useWillAppear

Fires once when the action instance appears and the React root is mounted. Use for initialization.

```ts
function useWillAppear(callback: (payload: WillAppearPayload) => void): void;

interface WillAppearPayload {
  settings: JsonObject;
  controller: "Keypad" | "Encoder";
  isInMultiAction: boolean;
}
```

### useWillDisappear

Fires when the action is about to disappear (React root is being unmounted).

```ts
function useWillDisappear(callback: () => void): void;
```

Note: Because `onWillDisappear` unmounts the entire React root, `useEffect` cleanup functions already handle teardown. `useWillDisappear` is a convenience for explicit opt-in.

## Context Hooks

### useDevice

Returns information about the Stream Deck device. Set once on mount (immutable).

```ts
function useDevice(): DeviceInfo;

interface DeviceInfo {
  id: string;
  type: number; // e.g. 0 (StreamDeck), 2 (StreamDeckXL), 7 (StreamDeckPlus)
  size: { columns: number; rows: number };
  name: string;
}
```

### useAction

Returns metadata about the current action instance. Set once on mount (immutable).

```ts
function useAction(): ActionInfo;

interface ActionInfo {
  id: string; // Unique context ID for this placed instance
  uuid: string; // Action UUID (e.g. 'com.example.plugin.counter')
  controller: "Keypad" | "Encoder";
  coordinates?: { row: number; column: number };
  isInMultiAction: boolean;
}
```

### useCanvas

Returns render target dimensions. Set once on mount (immutable).

```ts
function useCanvas(): CanvasInfo;

interface CanvasInfo {
  width: number; // Pixel width of the render target
  height: number; // Pixel height of the render target
  type: "key" | "dial" | "touch";
}
```

### useStreamDeck

Access the adapter and action handle. Use for operations not covered by the built-in hooks.

```ts
function useStreamDeck(): StreamDeckAccess;

interface StreamDeckAccess {
  action: AdapterActionHandle;
  adapter: StreamDeckAdapter;
}
```

## SDK Hooks

### useOpenUrl

Opens a URL in the user's default browser.

```ts
function useOpenUrl(): (url: string) => Promise<void>;
```

### useSwitchProfile

Switches to a different Stream Deck profile. If `deviceId` is omitted, the current device is used.

```ts
function useSwitchProfile(): (profile: string, deviceId?: string) => Promise<void>;
```

### useSendToPI

Sends a message to the Property Inspector.

```ts
function useSendToPI(): (payload: JsonValue) => Promise<void>;
```

### usePropertyInspector

Receives messages sent from the Property Inspector via `sendToPlugin`.

```ts
function usePropertyInspector<T extends JsonValue = JsonValue>(
  callback: (payload: T) => void,
): void;
```

### useShowAlert

Triggers the Stream Deck's built-in alert overlay animation on the key.

```ts
function useShowAlert(): () => Promise<void>;
```

### useShowOk

Triggers the OK checkmark overlay. Key actions only.

```ts
function useShowOk(): () => Promise<void>;
```

### useTitle

Sets the native Stream Deck title overlay (separate from the rendered image). Key actions only.

```ts
function useTitle(): (title: string) => Promise<void>;
```

## Utility Hooks

### useInterval

Auto-cleaning interval. Pass `null` to pause.

```ts
function useInterval(callback: () => void, delayMs: number | null): IntervalControls;

interface IntervalControls {
  reset: () => void; // Restart the interval from zero
}
```

### useTimeout

Auto-cleaning timeout. Pass `null` to cancel.

```ts
function useTimeout(callback: () => void, delayMs: number | null): TimeoutControls;

interface TimeoutControls {
  cancel: () => void;
  reset: () => void;
}
```

### usePrevious

Returns the value from the previous render. Undefined on first render.

```ts
function usePrevious<T>(value: T): T | undefined;
```

### useTick

Animation frame loop driven by timers. Receives elapsed milliseconds since the last tick.

```ts
function useTick(
  callback: (deltaMs: number) => void,
  fpsOrActive?: number | boolean, // Default: 30, max 30. Pass false to pause.
): void;
```

Actual frame rate is capped at 30fps — Stream Deck hardware refreshes at max 30Hz. In practice, real throughput is roughly 10-30fps depending on component complexity.

## Animation Hooks

Higher-level animation primitives built on top of `useTick`. Both hooks animate single numbers or objects of named numbers, automatically starting and stopping the tick loop when the animation is in motion or settled.

### useSpring

Spring physics-based animation. Returns animated value(s) that follow the target with damped harmonic oscillator dynamics (semi-implicit Euler integration).

```ts
function useSpring<T extends AnimationTarget>(
  target: T,
  config?: Partial<SpringConfig> & { fps?: number },
): SpringResult<T>;

type AnimationTarget = number | Record<string, number>;

type AnimatedValue<T extends AnimationTarget> = T extends number
  ? number
  : { [K in keyof T]: number };

interface SpringConfig {
  tension: number; // Stiffness. Default 170
  friction: number; // Damping. Default 26
  mass: number; // Mass. Default 1
  velocityThreshold: number; // Settle threshold. Default 0.01
  displacementThreshold: number; // Settle threshold. Default 0.005
  clamp: boolean; // No overshoot. Default false
}

interface SpringResult<T extends AnimationTarget> {
  value: AnimatedValue<T>; // Current interpolated value(s)
  isAnimating: boolean; // Whether the spring is still in motion
  set: (target: T) => void; // Imperatively update the target
  jump: (target: T) => void; // Jump immediately (no animation)
}
```

Built-in presets via `SpringPresets`:

| Preset     | Tension | Friction | Mass | Clamp | Use case             |
| ---------- | ------- | -------- | ---- | ----- | -------------------- |
| `default`  | 170     | 26       | 1    | no    | Balanced default     |
| `stiff`    | 400     | 28       | 1    | no    | Quick, responsive    |
| `wobbly`   | 180     | 12       | 1    | no    | Bouncy oscillation   |
| `gentle`   | 120     | 14       | 1    | no    | Slow and smooth      |
| `molasses` | 80      | 30       | 1    | no    | Very slow, ambient   |
| `snap`     | 300     | 36       | 1    | yes   | Snappy, no overshoot |
| `heavy`    | 200     | 20       | 3    | no    | Heavy object feel    |

Example:

```tsx
function SpringBounce() {
  const [pressed, setPressed] = useState(false);
  const [count, setCount] = useState(0);

  useKeyDown(() => {
    setPressed(true);
    setCount((c) => c + 1);
  });
  useKeyUp(() => setPressed(false));

  const { value: scale } = useSpring(pressed ? 0.8 : 1, {
    ...SpringPresets.wobbly,
    tension: 300,
  });

  const { value: hue } = useSpring((count * 40) % 360, SpringPresets.gentle);
  const size = Math.round(scale * 100);

  return (
    <div
      className="flex items-center justify-center w-full h-full"
      style={{ backgroundColor: `hsl(${Math.round(hue)}, 60%, 25%)` }}
    >
      <div
        className="flex flex-col items-center justify-center"
        style={{ width: `${size}%`, height: `${size}%` }}
      >
        <span className="text-white text-[48px] font-bold">{count}</span>
      </div>
    </div>
  );
}
```

Object targets animate each channel independently:

```tsx
const { value } = useSpring({ x: targetX, opacity: show ? 1 : 0 }, SpringPresets.gentle);
// value.x and value.opacity are plain numbers
```

### useTween

Duration + easing-based animation. Smoothly transitions to the target over a specified duration. When the target changes mid-tween, a new tween starts from the current interpolated position (no discontinuity).

```ts
function useTween<T extends AnimationTarget>(
  target: T,
  config?: Partial<TweenConfig>,
): TweenResult<T>;

interface TweenConfig {
  duration: number; // Milliseconds. Default 300
  easing: EasingName | EasingFn; // Default "easeOut"
  fps: number; // Default 30
}

interface TweenResult<T extends AnimationTarget> {
  value: AnimatedValue<T>; // Current interpolated value(s)
  progress: number; // 0..1 normalized progress
  isAnimating: boolean; // Whether the tween is still running
  set: (target: T) => void; // Imperatively start a new tween
  jump: (target: T) => void; // Jump immediately (no animation)
}

type EasingName =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "easeInCubic"
  | "easeOutCubic"
  | "easeInOutCubic"
  | "easeInBack"
  | "easeOutBack"
  | "easeOutBounce";

type EasingFn = (t: number) => number;
```

Built-in easings available via the `Easings` object: `linear`, `easeIn`, `easeOut`, `easeInOut`, `easeInCubic`, `easeOutCubic`, `easeInOutCubic`, `easeInBack`, `easeOutBack`, `easeOutBounce`.

Example:

```tsx
function FadeSlide() {
  const [index, setIndex] = useState(0);
  useKeyDown(() => setIndex((i) => (i + 1) % 4));

  const { value: bg } = useTween(index * 90, {
    duration: 400,
    easing: "easeOutCubic",
  });

  return (
    <div
      className="flex items-center justify-center w-full h-full"
      style={{ backgroundColor: `hsl(${Math.round(bg) % 360}, 50%, 25%)` }}
    >
      <span className="text-white text-[28px] font-bold">ITEM {index}</span>
    </div>
  );
}
```

Custom easing function:

```tsx
const { value } = useTween(target, {
  duration: 600,
  easing: (t) => 1 - Math.pow(1 - t, 4), // ease-out quartic
});
```

## Size Hook

### useSize

Returns a memoized size helper bound to the current canvas dimensions. Provides percentage-based and proportional size calculations.

```ts
function useSize(): SizeHelper;

interface SizeHelper {
  readonly width: number;
  readonly height: number;
  readonly min: number; // min(width, height)
  readonly max: number; // max(width, height)
  readonly square: boolean; // width === height
  readonly landscape: boolean; // width > height
  readonly portrait: boolean; // height > width
  readonly aspectRatio: number; // width / height
  w(percent: number): number; // % of width, rounded
  h(percent: number): number; // % of height, rounded
  minP(percent: number): number; // % of min dimension, rounded
  maxP(percent: number): number; // % of max dimension, rounded
  scale(basePx: number, referenceSize?: number): number;
}
```

The `scale()` method scales a pixel value proportionally using the minimum dimension as reference (default 144, the standard key size). A value of 16 on a 144×144 key stays 16. On a 200×100 dial, it becomes `Math.round(16 * 100/144) = 11`.

Example:

```tsx
function AdaptiveKey() {
  const size = useSize();

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-[#1a1a1a]">
      <span className="text-white" style={{ fontSize: size.scale(24) }}>
        {size.square ? "KEY" : "DIAL"}
      </span>
    </div>
  );
}
```

There is also a standalone `calcSize(width, height)` function that works outside React:

```ts
import { calcSize } from "@fcannizzaro/streamdeck-react";
const s = calcSize(200, 100);
s.w(50); // 100
```

## Coordinator Hooks

All coordinator hooks require `coordinator: true` in `createPlugin()`. They throw a helpful error if called without a coordinator context.

### useChannel

Named channel for cross-action state sharing. Works like `useState` but shared across all action roots.

```ts
function useChannel<T>(name: string, defaultValue: T): [T, (value: T) => void];
```

- **Scoped re-renders** — only subscribers of the changed channel re-render.
- **Sticky values** — new subscribers to existing channels receive the current value.
- **Referential skip** — updates skipped when `===` identity matches.
- Uses `useSyncExternalStore` for concurrent-mode safety.

Example:

```tsx
// In a "play/pause" action:
const [state, setState] = useChannel<"playing" | "paused">("playback", "paused");
useKeyDown(() => setState(state === "playing" ? "paused" : "playing"));

// In a "now playing" action (reads same channel):
const [state] = useChannel<"playing" | "paused">("playback", "paused");
```

### useActionPresence

Live snapshot of all currently visible action instances.

```ts
function useActionPresence(): ActionPresenceSnapshot;

interface ActionPresenceSnapshot {
  readonly all: readonly ActionPresenceInfo[];
  byUuid(uuid: string): readonly ActionPresenceInfo[];
  readonly count: number;
}

interface ActionPresenceInfo {
  id: string;
  uuid: string;
  surface: "key" | "dial" | "touch";
  coordinates?: { column: number; row: number };
  deviceId: string;
}
```

Re-renders only when the presence set changes (action appears or disappears).

### useCoordinator

Escape hatch — returns the raw `ActionCoordinator` instance for imperative operations.

```ts
function useCoordinator(): ActionCoordinator;
```

Example:

```tsx
const coordinator = useCoordinator();
useKeyDown(() => {
  coordinator.setChannelValue("volume", 50);
});
```

## Theme Hook

### useTheme

Returns the current theme's CSS variables and a setter for dynamic switching.

```ts
function useTheme(): [ThemeVariables, (theme: ThemeDefinition) => void];

type ThemeVariables = Record<string, string>;
```

Example:

```tsx
const [variables, setTheme] = useTheme();
// variables = { "--color-primary": "#4CAF50", "--color-surface": "#1a1a2e", ... }

// Dynamic switch:
useKeyDown(() => setTheme(darkTheme));
```

If no theme is configured, returns an empty object `{}`. The setter replaces the active theme — all roots re-render with the new CSS variables.
