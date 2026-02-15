/**
 * Teapot alert display utilities for Stream Deck keys.
 */

import { buildBadgeSvg } from "./banner";

const SIZE = 144;
const TUBBY_WIDTH = 143;
const TUBBY_HEIGHT = 161;
const TUBBY_X_OFFSET = (SIZE - TUBBY_WIDTH) / 2;
const TUBBY_Y_OFFSET = (SIZE - TUBBY_HEIGHT) / 2 + 10;
const CENTER = SIZE / 2;

const FLOAT_FRAMES = 48;
const FLOAT_AMPLITUDE_Y = 5;
const FLOAT_AMPLITUDE_X = 0.5;
const FLOAT_AMPLITUDE_R = 1;

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Programmatically generated floating keyframes using sine waves.
 * 32 frames at 50ms = ~1.6s per full cycle.
 * Y: sin(t) * FLOAT_AMPLITUDE_Y -- main vertical bob ±5px
 * X: cos(t*1.5) * FLOAT_AMPLITUDE_X -- very subtle horizontal drift ±0.5px
 * R: sin(t + π/4) * FLOAT_AMPLITUDE_R -- gentle tilt ±1°
 */
export const TUBBY_FLOATS: ReadonlyArray<{ x: number; y: number; r: number }> =
  Array.from({ length: FLOAT_FRAMES }, (_, i) => {
    const t = (i / FLOAT_FRAMES) * Math.PI * 2;
    return {
      x: round1(Math.cos(t * 1.5) * FLOAT_AMPLITUDE_X),
      y: round1(Math.sin(t) * FLOAT_AMPLITUDE_Y),
      r: round1(Math.sin(t + Math.PI / 4) * FLOAT_AMPLITUDE_R),
    };
  });

/**
 * Build a 3-layer SVG for the teapot action display.
 *
 * Layer 1: Base background (teapotState@2x.png)
 * Layer 2: Tubby overlay with floating animation
 * Layer 3: Text bar at the bottom (percentage or "MAX COIN!")
 *
 * @param baseDataUri Data URI of the background image
 * @param tubbyDataUri Data URI of the tubby overlay image
 * @param frameIndex Current animation frame index
 * @param text Text to display in the bottom bar (e.g. "75%" or "MAX COIN!")
 * @param isMax Whether coins are at maximum (applies red tint to background)
 * @returns SVG string suitable for Stream Deck setImage
 */
export const buildTeapotAlertSvg = (
  baseDataUri: string,
  tubbyDataUri: string,
  frameIndex: number,
  text: string,
  isMax: boolean,
): string => {
  const float = TUBBY_FLOATS[frameIndex % TUBBY_FLOATS.length]!;

  const redTint = isMax
    ? `<rect x="0" y="0" width="${SIZE}" height="${SIZE}" fill="red" style="opacity: 0.3" />`
    : "";

  const badgeSvg = buildBadgeSvg(text);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <image href="${baseDataUri}" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid slice" />
  ${redTint}
  <image href="${tubbyDataUri}" x="${TUBBY_X_OFFSET + float.x}" y="${TUBBY_Y_OFFSET + float.y}" width="${TUBBY_WIDTH}" height="${TUBBY_HEIGHT}" preserveAspectRatio="xMidYMid meet" transform="rotate(${float.r}, ${CENTER + float.x}, ${CENTER + float.y})" />
  ${badgeSvg}
</svg>`;
};
