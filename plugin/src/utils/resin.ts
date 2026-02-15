/**
 * Resin fill-gauge SVG builder for Stream Deck keys.
 *
 * Layers (back to front):
 *   1. Base background (3-star.webp)
 *   2. Full-brightness resin icon (floating)
 *   3. Dark overlay rect covering the unfilled top portion
 *   4. Bottom pill badge with current resin count
 *
 * The overlay darkens the top of the resin icon so it appears
 * "filled" from the bottom up based on the current resin percentage.
 * The resin icon floats using pre-computed sine-wave keyframes.
 */

import { buildBadgeSvg } from "./banner";

const SIZE = 144;

/** Float animation configuration */
const FLOAT_FRAMES = 48;
const FLOAT_AMPLITUDE_Y = 5;
const FLOAT_AMPLITUDE_X = 0.5;
const FLOAT_AMPLITUDE_R = 1;

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Pre-computed floating keyframes using sine waves.
 * 48 frames at 200ms = ~9.6s per full cycle.
 */
export const RESIN_FLOATS: ReadonlyArray<{ x: number; y: number; r: number }> =
  Array.from({ length: FLOAT_FRAMES }, (_, i) => {
    const t = (i / FLOAT_FRAMES) * Math.PI * 2;
    return {
      x: round1(Math.cos(t * 1.5) * FLOAT_AMPLITUDE_X),
      y: round1(Math.sin(t) * FLOAT_AMPLITUDE_Y),
      r: round1(Math.sin(t + Math.PI / 4) * FLOAT_AMPLITUDE_R),
    };
  });

/**
 * Build a fill-gauge SVG for the resin action display.
 * @param baseDataUri  Data URI of the background image (3-star.webp)
 * @param resinDataUri Data URI of the resin icon (resin.webp)
 * @param frameIndex   Current animation frame index
 * @param current      Current resin count
 * @param max          Maximum resin (e.g. 200)
 * @returns Raw SVG string
 */
export const buildResinSvg = (
  baseDataUri: string,
  resinDataUri: string,
  frameIndex: number,
  current: number,
  max: number,
  iconScale = 1,
): string => {
  const float = RESIN_FLOATS[frameIndex % RESIN_FLOATS.length]!;
  const percentage = Math.min(Math.max(current / max, 0), 1);
  const coverH = Math.round(SIZE * (1 - percentage));

  const text = `${current}`;
  const badgeSvg = buildBadgeSvg(text);

  const iconSize = SIZE * iconScale;
  const iconOffset = (SIZE - iconSize) / 2;
  const iconX = iconOffset + float.x;
  const iconY = iconOffset + float.y;
  const iconCenterX = iconOffset + iconSize / 2 + float.x;
  const iconCenterY = iconOffset + iconSize / 2 + float.y;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <image href="${baseDataUri}" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid slice" />
  <image href="${resinDataUri}" x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" preserveAspectRatio="xMidYMid meet" transform="rotate(${float.r}, ${iconCenterX}, ${iconCenterY})" />
  <rect x="0" y="0" width="${SIZE}" height="${coverH}" fill="black" opacity="0.6" />
  ${badgeSvg}
</svg>`;
};
