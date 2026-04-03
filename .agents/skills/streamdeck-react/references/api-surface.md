# API Surface

Complete public API exported from `@fcannizzaro/streamdeck-react`.

## Plugin Setup

| Export                 | Type     | Description                                                                                               |
| ---------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `createPlugin(config)` | Function | Creates and configures the plugin runtime. Returns `{ connect() }`.                                       |
| `defineAction(config)` | Function | Maps a manifest UUID to React components for key and dial rendering, plus touch-aware action definitions. |
| `googleFont(family, variants?)` | Function | Downloads TTF fonts from Google Fonts. Returns `FontConfig` or `FontConfig[]`. Cached to `.google-fonts/` on disk. |

## Adapter

| Export                      | Type     | Description                                                                                          |
| --------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `physicalDevice()`          | Function | Creates a `StreamDeckAdapter` wrapping the `@elgato/streamdeck` SDK. Default when `adapter` omitted. |
| `StreamDeckAdapter`         | Type     | Main adapter contract. Implement for custom backends (web simulator, test harness).                  |
| `AdapterActionHandle`       | Type     | Flat per-action handle unifying Key/Dial/Action operations.                                          |
| `AdapterActionCallbacks`    | Type     | Callback interface for action registration. Adapter invokes when events fire.                        |
| `AdapterWillAppearEvent`    | Type     | Event payload for `onWillAppear` callbacks.                                                          |
| `AdapterActionDevice`       | Type     | Device info from an action event: `id`, `type`, `size`, `name`.                                      |
| `AdapterController`         | Type     | `"Keypad" \| "Encoder"`.                                                                             |
| `AdapterCoordinates`        | Type     | `{ column, row }`.                                                                                   |
| `AdapterSize`               | Type     | `{ columns, rows }`.                                                                                 |
| `AdapterTriggerDescription` | Type     | Dial hint labels: `{ rotate?, push?, touch?, longTouch? }`.                                          |

## Event Hooks

| Export          | Signature                                            | Description                                        |
| --------------- | ---------------------------------------------------- | -------------------------------------------------- |
| `useKeyDown`    | `(cb: (payload: KeyDownPayload) => void) => void`    | Fires when a key is pressed down.                  |
| `useKeyUp`      | `(cb: (payload: KeyUpPayload) => void) => void`      | Fires when a key is released.                      |
| `useDialRotate` | `(cb: (payload: DialRotatePayload) => void) => void` | Fires when a dial/encoder is rotated.              |
| `useDialDown`   | `(cb: (payload: DialPressPayload) => void) => void`  | Fires when a dial is pressed.                      |
| `useDialUp`     | `(cb: (payload: DialPressPayload) => void) => void`  | Fires when a dial is released.                     |
| `useTouchTap`   | `(cb: (payload: TouchTapPayload) => void) => void`   | Fires when the touch strip is tapped.              |
| `useDialHint`   | `(hints: DialHints) => void`                         | Sets encoder trigger descriptions on Stream Deck+. |

## Gesture Hooks

| Export         | Signature                                                                     | Description                                                                |
| -------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `useTap`       | `(cb: (payload: KeyUpPayload) => void, options?: TapOptions) => void`         | Single tap. Auto-delayed when `useDoubleTap` is active on the same action. |
| `useLongPress` | `(cb: (payload: KeyDownPayload) => void, options?: LongPressOptions) => void` | Fires when key is held for `timeout` ms (default 500).                     |
| `useDoubleTap` | `(cb: (payload: KeyUpPayload) => void, options?: DoubleTapOptions) => void`   | Fires on two rapid taps within `timeout` ms (default 250).                 |

## Settings Hooks

| Export              | Signature                                                        | Description                                                      |
| ------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| `useSettings`       | `<S extends JsonObject>() => [S, (partial: Partial<S>) => void]` | Bidirectional per-action settings sync. Shallow-merge semantics. |
| `useGlobalSettings` | `<G extends JsonObject>() => [G, (partial: Partial<G>) => void]` | Plugin-wide global settings sync. Same merge semantics.          |

## Context Hooks

| Export          | Signature                | Description                                                              |
| --------------- | ------------------------ | ------------------------------------------------------------------------ |
| `useDevice`     | `() => DeviceInfo`       | Device ID, type, size, and name. Set once on mount.                      |
| `useAction`     | `() => ActionInfo`       | Action context ID, UUID, controller, coordinates. Set once on mount.     |
| `useCanvas`     | `() => CanvasInfo`       | Render target dimensions (`width`, `height`, `type`). Set once on mount. |
| `useStreamDeck` | `() => StreamDeckAccess` | Adapter and action handle: `{ action, adapter }`.                        |

## Lifecycle Hooks

| Export             | Signature                                            | Description                                                    |
| ------------------ | ---------------------------------------------------- | -------------------------------------------------------------- |
| `useWillAppear`    | `(cb: (payload: WillAppearPayload) => void) => void` | Fires once when the action appears and the root is mounted.    |
| `useWillDisappear` | `(cb: () => void) => void`                           | Fires when the action is about to disappear (root unmounting). |

## Utility Hooks

| Export        | Signature                                                                  | Description                                                                |
| ------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `useInterval` | `(cb: () => void, delayMs: number \| null) => IntervalControls`            | Auto-cleaning interval. Pass `null` to pause. Returns `{ reset }`.         |
| `useTimeout`  | `(cb: () => void, delayMs: number \| null) => TimeoutControls`             | Auto-cleaning timeout. Pass `null` to cancel. Returns `{ cancel, reset }`. |
| `usePrevious` | `<T>(value: T) => T \| undefined`                                          | Returns the value from the previous render.                                |
| `useTick`     | `(cb: (deltaMs: number) => void, fpsOrActive?: number \| boolean) => void` | Animation frame loop. Default 30fps, max 30fps. Pass `false` to pause.     |

## Animation Hooks

| Export          | Signature                                                                                                      | Description                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `useSpring`     | `<T extends AnimationTarget>(target: T, config?: Partial<SpringConfig> & { fps?: number }) => SpringResult<T>` | Spring physics animation. Returns animated value(s) following the target with damped harmonic motion. |
| `useTween`      | `<T extends AnimationTarget>(target: T, config?: Partial<TweenConfig>) => TweenResult<T>`                      | Duration + easing animation. Smoothly transitions to the target over a specified duration.            |
| `SpringPresets` | `Record<string, Partial<SpringConfig>>`                                                                        | Built-in spring configs: `default`, `stiff`, `wobbly`, `gentle`, `molasses`, `snap`, `heavy`.         |
| `Easings`       | `Record<EasingName, EasingFn>`                                                                                 | Built-in easing functions: `linear`, `easeIn`, `easeOut`, `easeInOut`, cubics, back, bounce.          |

## SDK Hooks

| Export                 | Signature                                                     | Description                                          |
| ---------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| `useOpenUrl`           | `() => (url: string) => Promise<void>`                        | Opens a URL in the user's default browser.           |
| `useSwitchProfile`     | `() => (profile: string, deviceId?: string) => Promise<void>` | Switches Stream Deck profile.                        |
| `useSendToPI`          | `() => (payload: JsonValue) => Promise<void>`                 | Sends a message to the Property Inspector.           |
| `usePropertyInspector` | `<T extends JsonValue>(cb: (payload: T) => void) => void`     | Receives messages from the Property Inspector.       |
| `useShowAlert`         | `() => () => Promise<void>`                                   | Triggers the alert overlay animation.                |
| `useShowOk`            | `() => () => Promise<void>`                                   | Triggers the OK checkmark overlay. Key actions only. |
| `useTitle`             | `() => (title: string) => Promise<void>`                      | Sets the native title overlay. Key actions only.     |

## Touch Bar Hooks

| Export                    | Signature                                                      | Description                                                            |
| ------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `useTouchStrip`           | `() => TouchStripInfo`                                         | Returns touch bar metadata: width, height, columns, segmentWidth.      |
| `useTouchStripTap`        | `(cb: (payload: TouchStripTapPayload) => void) => void`        | Touch events with absolute coordinates across the full strip.          |
| `useTouchStripDialRotate` | `(cb: (payload: TouchStripDialRotatePayload) => void) => void` | Dial rotation events with column info.                                 |
| `useTouchStripDialDown`   | `(cb: (payload: TouchStripDialPressPayload) => void) => void`  | Dial press events with column info.                                    |
| `useTouchStripDialUp`     | `(cb: (payload: TouchStripDialPressPayload) => void) => void`  | Dial release events with column info.                                  |

## Components

| Export          | Element | Description                                        |
| --------------- | ------- | -------------------------------------------------- |
| `Box`           | `div`   | Flex container with shorthand layout props.        |
| `Text`          | `span`  | Text with shorthand style props.                   |
| `Image`         | `img`   | Image with required dimensions and optional `fit`. |
| `Icon`          | `svg`   | Single SVG path icon.                              |
| `ProgressBar`   | `div`   | Horizontal progress bar.                           |
| `CircularGauge` | `svg`   | Ring/arc gauge via SVG.                            |
| `ErrorBoundary` | --      | React error boundary with fallback.                |

## Tailwind Utility

| Export | Signature                                                               | Description                               |
| ------ | ----------------------------------------------------------------------- | ----------------------------------------- |
| `tw`   | `(...args: Array<string \| false \| null \| undefined \| 0>) => string` | Class string concatenation (like `clsx`). |

## Rollup Helpers (from `@fcannizzaro/streamdeck-react/rollup`)

| Export                      | Description                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `streamDeckReact(options?)` | Rollup plugin that copies the selected `@takumi-rs/core` native `.node` binaries into the output directory. |

### Rollup Types

| Export                    | Description                                   |
| ------------------------- | --------------------------------------------- |
| `StreamDeckTargetOptions` | Rollup helper options with a `targets` array and optional `takumi` backend. |
| `StreamDeckTarget`        | One native copy target: `{ platform, arch }`. |
| `StreamDeckPlatform`      | `'darwin' \| 'win32'`.                        |
| `StreamDeckArch`          | `'arm64' \| 'x64'`.                           |

## Vite Helpers (from `@fcannizzaro/streamdeck-react/vite`)

| Export                      | Description                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `streamDeckReact(options?)` | Vite plugin. Same native binary copying as Rollup, plus optional `uuid` for auto-restart via `streamdeck restart <uuid>` after each build. |

### Vite Types

| Export                    | Description                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `StreamDeckReactOptions`  | Extends `StreamDeckTargetOptions` with `uuid?: string` and `manifest?: string \| false`. |
| `StreamDeckTargetOptions` | Shared options with a `targets` array and optional `takumi` backend.             |
| `StreamDeckTarget`        | One native copy target: `{ platform, arch }`.                                            |
| `StreamDeckPlatform`      | `'darwin' \| 'win32'`.                                                                   |
| `StreamDeckArch`          | `'arm64' \| 'x64'`.                                                                      |

## Types

| Export                        | Kind      | Description                                                                                                          |
| ----------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| `PluginConfig`                | Interface | Configuration for `createPlugin()`.                                                                                  |
| `FontConfig`                  | Interface | Font file descriptor: `name`, `data`, `weight`, `style`.                                                             |
| `GoogleFontVariant`           | Interface | Google Font variant options: `weight?`, `style?`. Used with `googleFont()`.                                           |
| `ActionConfig`                | Interface | Configuration for `defineAction()`.                                                                                  |
| `ActionDefinition`            | Interface | Resolved action definition (output of `defineAction`).                                                               |
| `EncoderLayout`               | Type      | `string \| TouchStripLayout`.                                                                                        |
| `WrapperComponent`            | Type      | `ComponentType<{ children?: ReactNode }>`.                                                                           |
| `DeviceInfo`                  | Interface | Device metadata: `id`, `type`, `size`, `name`.                                                                       |
| `ActionInfo`                  | Interface | Action instance metadata: `id`, `uuid`, `controller`, `coordinates`, `isInMultiAction`.                              |
| `CanvasInfo`                  | Interface | Render target: `width`, `height`, `type` (`'key' \| 'dial' \| 'touch'`).                                             |
| `KeyDownPayload`              | Interface | `{ settings, isInMultiAction, state?, userDesiredState? }`.                                                          |
| `KeyUpPayload`                | Interface | Same shape as `KeyDownPayload`.                                                                                      |
| `DialRotatePayload`           | Interface | `{ ticks, pressed, settings }`.                                                                                      |
| `DialPressPayload`            | Interface | `{ settings, controller: 'Encoder' }`.                                                                               |
| `TouchTapPayload`             | Interface | `{ tapPos: [x, y], hold, settings }`.                                                                                |
| `DialHints`                   | Interface | `{ rotate?, press?, touch?, longTouch? }`.                                                                           |
| `StreamDeckAccess`            | Interface | `{ action: AdapterActionHandle, adapter: StreamDeckAdapter }`.                                                       |
| `TouchStripInfo`              | Interface | `{ width, height, columns, segmentWidth }`.                                                                          |
| `TouchStripTapPayload`        | Interface | `{ tapPos: [x, y], hold, column }`.                                                                                  |
| `TouchStripDialRotatePayload` | Interface | `{ column, ticks, pressed }`.                                                                                        |
| `TouchStripDialPressPayload`  | Interface | `{ column }`.                                                                                                        |
| `TouchStripLayout`            | Interface | `{ $schema?, id, items: TouchStripLayoutItem[] }`.                                                                   |
| `TouchStripLayoutItem`        | Type      | Union of `TouchStripBarItem \| TouchStripGBarItem \| TouchStripPixmapItem \| TouchStripTextItem`.                    |
| `TapOptions`                  | Interface | `{ timeout?: number }`.                                                                                              |
| `LongPressOptions`            | Interface | `{ timeout?: number }`. Default: 500ms.                                                                              |
| `DoubleTapOptions`            | Interface | `{ timeout?: number }`. Default: 250ms.                                                                              |
| `AnimationTarget`             | Type      | `number \| Record<string, number>`.                                                                                  |
| `AnimatedValue<T>`            | Type      | Maps `AnimationTarget` shape to output: `number` stays `number`, objects map keys.                                   |
| `SpringConfig`                | Interface | Spring physics config: `tension`, `friction`, `mass`, thresholds, `clamp`.                                           |
| `SpringResult<T>`             | Interface | `{ value, isAnimating, set, jump }`.                                                                                 |
| `EasingName`                  | Type      | Union of 10 easing name strings.                                                                                     |
| `EasingFn`                    | Type      | `(t: number) => number`.                                                                                             |
| `TweenConfig`                 | Interface | `{ duration, easing, fps }`.                                                                                         |
| `TweenResult<T>`              | Interface | `{ value, progress, isAnimating, set, jump }`.                                                                       |
| `RenderProfile`               | Interface | Per-render timing and diagnostic data: timing breakdowns, skipped, cacheHit, treeDepth, nodeCount.                   |
| `CacheStats`                  | Interface | Image cache statistics: entries, bytes, maxBytes, hits, misses.                                                      |
| `RenderMetrics`               | Interface | Rolling-window render pipeline statistics: flush/skip counts, avg/peak render time, cache bytes.                     |
| `TakumiBackend`               | Type      | `"native-binding" \| "wasm"`. Renderer backend selection.                                                            |
| `Controller`                  | Type      | `"Keypad" \| "Encoder"`. Controller surface type.                                                                    |
| `Coordinates`                 | Interface | `{ column, row }`. Grid coordinates for a key or encoder.                                                            |
| `Size`                        | Interface | `{ columns, rows }`. Device grid size.                                                                               |
| `ActionConfigInput<S>`        | Type      | Discriminated union for `defineAction()`. Falls back to `ActionConfig<S>` when `ManifestActions` is empty.            |
| `ActionUUID`                  | Type      | Union of all manifest action UUIDs when available, plain `string` otherwise.                                         |
| `ManifestActions`             | Interface | Empty by default. Can be augmented for compile-time UUID validation.                                                  |

## Component Props Types

| Export               | Description                          |
| -------------------- | ------------------------------------ |
| `BoxProps`           | Props for `Box` component.           |
| `TextProps`          | Props for `Text` component.          |
| `ImageProps`         | Props for `Image` component.         |
| `IconProps`          | Props for `Icon` component.          |
| `ProgressBarProps`   | Props for `ProgressBar` component.   |
| `CircularGaugeProps` | Props for `CircularGauge` component. |
| `ErrorBoundaryProps` | Props for `ErrorBoundary` component. |
