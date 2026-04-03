# Components

All components are optional convenience wrappers. Raw HTML elements (`div`, `span`, `img`, `svg`, `p`) work directly in `@fcannizzaro/streamdeck-react`.

## Box

Renders a `div` with `display: flex` and convenience layout props.

```tsx
import { Box } from "@fcannizzaro/streamdeck-react";
```

```ts
interface BoxProps {
  className?: string;
  center?: boolean; // Sets alignItems and justifyContent to 'center'
  padding?: number; // Padding in pixels
  background?: string; // Background color
  borderRadius?: number; // Border radius in pixels
  gap?: number; // Gap between children in pixels
  direction?: "row" | "column"; // Default: 'column'
  style?: CSSProperties; // Merged last, can override shorthands
  children?: ReactNode;
}
```

Example:

```tsx
<Box center padding={8} background="#1a1a1a" borderRadius={12} gap={4}>
  <Text size={12} color="#888">
    LABEL
  </Text>
  <Text size={24} color="white" weight={700}>
    42
  </Text>
</Box>
```

## Text

Renders a `span` with shorthand text styling props.

```tsx
import { Text } from "@fcannizzaro/streamdeck-react";
```

```ts
interface TextProps {
  className?: string;
  size?: number; // fontSize
  color?: string; // color
  weight?: number; // fontWeight
  align?: "left" | "center" | "right"; // textAlign
  font?: string; // fontFamily
  lineHeight?: number; // lineHeight
  style?: CSSProperties;
  children?: ReactNode;
}
```

Example:

```tsx
<Text size={24} color="white" weight={700} align="center" font="Inter">
  Hello
</Text>
```

Font must be loaded in `createPlugin()` for text to render.

## Image

Renders an `img` element with required dimensions.

```tsx
import { Image } from "@fcannizzaro/streamdeck-react";
```

```ts
interface ImageProps {
  className?: string;
  src: string; // URL, base64 data URI, or Buffer
  width: number; // Required
  height: number; // Required
  fit?: "contain" | "cover"; // Maps to objectFit
  borderRadius?: number;
  style?: CSSProperties;
}
```

Example:

```tsx
<Image src="data:image/png;base64,..." width={48} height={48} fit="contain" />
```

Always provide explicit `width` and `height` for all `img` elements.

## Icon

Renders an `svg` element with a single `path` for simple icons.

```tsx
import { Icon } from "@fcannizzaro/streamdeck-react";
```

```ts
interface IconProps {
  className?: string;
  path: string; // SVG path d attribute data
  size?: number; // Default: 24. Width and height in pixels
  color?: string; // Default: 'white'. Fill color
  viewBox?: string; // Default: '0 0 24 24'
  style?: CSSProperties;
}
```

Example with icon library path data:

```tsx
const mdiPlay = "M8,5.14V19.14L19,12.14L8,5.14Z";
<Icon path={mdiPlay} size={48} color="#4CAF50" />;
```

## ProgressBar

Renders a horizontal progress bar.

```tsx
import { ProgressBar } from "@fcannizzaro/streamdeck-react";
```

```ts
interface ProgressBarProps {
  className?: string;
  value: number; // Current value
  max?: number; // Default: 100
  height?: number; // Default: 8. Bar height in pixels
  color?: string; // Default: '#4CAF50'. Fill color
  background?: string; // Default: '#333'. Track background
  borderRadius?: number; // Default: 4
  style?: CSSProperties;
}
```

Takes `width: '100%'` by default, filling its parent container.

Example:

```tsx
<ProgressBar value={75} max={100} height={8} color="#4CAF50" />
```

## CircularGauge

Renders a circular ring/arc gauge using SVG `stroke-dasharray`.

```tsx
import { CircularGauge } from "@fcannizzaro/streamdeck-react";
```

```ts
interface CircularGaugeProps {
  className?: string;
  value: number; // Current value
  max?: number; // Default: 100
  size?: number; // Default: 80. Diameter in pixels
  strokeWidth?: number; // Default: 6. Ring thickness
  color?: string; // Default: '#2196F3'. Foreground arc color
  background?: string; // Default: '#333'. Background ring color
  style?: CSSProperties;
}
```

Example:

```tsx
<CircularGauge value={75} max={100} size={80} strokeWidth={6} color="#2196F3" />
```

## ErrorBoundary

Standard React error boundary that catches errors in its child tree.

```tsx
import { ErrorBoundary } from "@fcannizzaro/streamdeck-react";
```

```ts
interface ErrorBoundaryProps {
  fallback?: ReactNode; // Default: red background with "Error" text
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  children: ReactNode;
}
```

Example:

```tsx
<ErrorBoundary fallback={<MyErrorFallback />}>
  <RiskyComponent />
</ErrorBoundary>
```

Note: Every action root is automatically wrapped in an error boundary by the library. If a component throws, the key shows a red error indicator and the error is logged. Other action instances are unaffected. Customize via `onActionError` in `createPlugin()`.
