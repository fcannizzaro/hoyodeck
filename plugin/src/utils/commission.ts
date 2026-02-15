/**
 * Commission display utilities for Stream Deck keys.
 *
 * Three visual states, all using the same animation (horizontal drift + eye blink):
 * - Unfinished: commissions still in progress
 * - Completed: all commissions done, reward not yet claimed
 * - Rewarded: extra task reward claimed
 */

import { buildBadgeSvg } from "./banner";

const SIZE = 144;

const round1 = (n: number): number => Math.round(n * 10) / 10;

/* ---------- animation constants ---------- */

const TOTAL_FRAMES = 30;
const AMPLITUDE_X = 2;

/** Blink window: eyes closed for frames 12–15 (brief natural blink) */
const BLINK_START = 12;
const BLINK_END = 15;

/**
 * Pre-computed float frames with horizontal drift and periodic blink.
 */
const FLOATS: ReadonlyArray<{ x: number; blink: boolean }> = Array.from(
  { length: TOTAL_FRAMES },
  (_, i) => {
    const t = (i / TOTAL_FRAMES) * Math.PI * 2;
    return {
      x: round1(Math.sin(t) * AMPLITUDE_X),
      blink: i >= BLINK_START && i <= BLINK_END,
    };
  },
);

/* ---------- data URIs container ---------- */

/**
 * Image pair for a single commission state (open + closed eyes).
 * The caller selects the right pair based on the current state.
 */
export interface CommissionImages {
  /** Background image */
  background: string;
  /** Character with eyes open */
  open: string;
  /** Character with eyes closed (blink frame) */
  closed: string;
}

/* ---------- SVG builder ---------- */

/**
 * Build an animated SVG for the commission action display.
 *
 * Layers (back to front):
 *   1. Background image
 *   2. Character image (open or closed eyes, with horizontal drift)
 *   3. Bottom text bar with commission count
 *
 * @param images Background + open/closed eye pair for the current state
 * @param frameIndex Current animation frame index (wraps automatically)
 * @param text Text to display in the bottom bar (e.g. "2/4"), or undefined to hide it
 * @returns SVG string suitable for Stream Deck setImage
 */
export const buildCommissionSvg = (
  images: CommissionImages,
  frameIndex: number,
  text?: string,
): string => {
  const float = FLOATS[frameIndex % FLOATS.length]!;
  const charDataUri = float.blink ? images.closed : images.open;

  const textLayer = text !== undefined ? buildBadgeSvg(text) : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <image href="${images.background}" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid slice" />
  <image href="${charDataUri}" x="${float.x}" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid meet" />
  ${textLayer}
</svg>`;
};
