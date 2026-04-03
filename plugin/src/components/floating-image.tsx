import { useState, useRef } from "react";
import { useTick } from "@fcannizzaro/streamdeck-react";

const SIZE = 144;

/** Animation parameters */
const CYCLE_DURATION_MS = 2400;
const FLOAT_AMPLITUDE_Y = 5;
const FLOAT_AMPLITUDE_X = 0.5;
const FLOAT_AMPLITUDE_R = 1;

interface FloatingImageProps {
  src: string;
  /** Scale factor for the icon (1 = full size) */
  scale?: number;
  /** Whether to animate (false = static at rest position) */
  animate?: boolean;
  /** Target FPS (max 30, default 15) */
  fps?: number;
}

/**
 * Floating animated image with gentle bob, drift, and tilt.
 *
 * Uses `useTick` for smooth continuous animation driven by elapsed time
 * rather than discrete keyframe stepping. The sine-wave positions are
 * computed each frame from accumulated time, producing fluid motion.
 */
export function FloatingImage({ src, scale = 1, animate = true, fps = 15 }: FloatingImageProps) {
  const elapsedRef = useRef(0);
  const [pos, setPos] = useState({ x: 0, y: 0, r: 0 });

  useTick(
    (deltaMs) => {
      elapsedRef.current += deltaMs;
      const t = (elapsedRef.current / CYCLE_DURATION_MS) * Math.PI * 2;
      setPos({
        x: Math.cos(t * 1.5) * FLOAT_AMPLITUDE_X,
        y: Math.sin(t) * FLOAT_AMPLITUDE_Y,
        r: Math.sin(t + Math.PI / 4) * FLOAT_AMPLITUDE_R,
      });
    },
    animate ? fps : false,
  );

  const iconSize = SIZE * scale;
  const iconOffset = (SIZE - iconSize) / 2;

  return (
    <div
      className="absolute"
      style={{
        top: iconOffset + pos.y,
        left: iconOffset + pos.x,
        width: iconSize,
        height: iconSize,
        transform: `rotate(${pos.r}deg)`,
      }}
    >
      <img src={src} width={iconSize} height={iconSize} />
    </div>
  );
}
