/**
 * Expedition display utilities for Stream Deck keys.
 *
 * Layout on a 144x144 SVG canvas:
 *   - 1–3 expeditions: single row of large circular avatars
 *   - 4–5 expeditions: two rows of medium circular avatars
 *   - Bottom: pill badge with "X / Y" counter
 */

import { buildBadgeSvg, BADGE_TOP_Y } from "./banner";

const SIZE = 144;
const AVATAR_IMG_SCALE = 1.1;
const AVATAR_BORDER_COLOR = "#6B4226";

/** Avatar radius per layout mode */
const AVATAR_R_SINGLE = 28;
const AVATAR_R_DOUBLE = 24;

/** Available height for avatars (above the bottom pill badge) */
const AVAILABLE_H = BADGE_TOP_Y;

/** Data needed to render one expedition */
export interface ExpeditionCircle {
  /** Base64 data URI of the character avatar */
  avatarDataUri: string;
  /** Whether the expedition is finished */
  finished: boolean;
  /** Remaining time in seconds (0 if finished) */
  remainingSeconds: number;
}

/**
 * Compute avatar positions for one or two rows.
 * @param count Total number of expeditions (1–5)
 * @returns Array of { cx, cy } positions and the avatar radius to use
 */
const computeAvatarLayout = (
  count: number,
): { positions: Array<{ cx: number; cy: number }>; radius: number } => {
  if (count <= 3) {
    // Single row, large avatars, centered vertically
    const cy = Math.round(AVAILABLE_H / 2);
    const spacing = SIZE / (count + 1);
    const positions = Array.from({ length: count }, (_, i) => ({
      cx: Math.round(spacing * (i + 1)),
      cy,
    }));
    return { positions, radius: AVATAR_R_SINGLE };
  }

  // Two rows, medium avatars
  const row1Count = Math.ceil(count / 2);
  const row2Count = count - row1Count;
  const row1Cy = Math.round(AVAILABLE_H / 3);
  const row2Cy = Math.round((AVAILABLE_H * 2) / 3);

  const row1Spacing = SIZE / (row1Count + 1);
  const row2Spacing = SIZE / (row2Count + 1);

  const positions: Array<{ cx: number; cy: number }> = [];

  for (let i = 0; i < row1Count; i++) {
    positions.push({
      cx: Math.round(row1Spacing * (i + 1)),
      cy: row1Cy,
    });
  }

  for (let i = 0; i < row2Count; i++) {
    positions.push({
      cx: Math.round(row2Spacing * (i + 1)),
      cy: row2Cy,
    });
  }

  return { positions, radius: AVATAR_R_DOUBLE };
};

/**
 * Build the expedition display SVG for a Stream Deck 144x144 key.
 *
 * Layers (back to front):
 *   1. Background image
 *   2. Circular avatars (1 or 2 rows)
 *   3. Bottom pill with completed/total counter
 *
 * @param backgroundDataUri Data URI of the background image
 * @param expeditions Array of expedition data (0–5 items)
 * @param totalExpeditions Total expedition slot count
 * @returns SVG string suitable for Stream Deck setImage
 */
export const buildExpeditionSvg = (
  backgroundDataUri: string,
  expeditions: ExpeditionCircle[],
  totalExpeditions: number,
): string => {
  const count = Math.min(expeditions.length, 5);
  const finishedCount = expeditions.filter((e) => e.finished).length;

  if (count === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <image href="${backgroundDataUri}" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid slice" />
</svg>`;
  }

  const { positions, radius } = computeAvatarLayout(count);

  // Clip paths for circular avatars
  const defs = positions
    .map(
      (pos, i) =>
        `<clipPath id="c${i}"><circle cx="${pos.cx}" cy="${pos.cy}" r="${radius}" /></clipPath>`,
    )
    .join("\n    ");

  // Avatar images
  const imgSize = Math.round(radius * 2 * AVATAR_IMG_SCALE);
  const imgOffset = imgSize / 2;

  const avatars = expeditions
    .map((exp, i) => {
      const { cx, cy } = positions[i]!;
      const bg = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${AVATAR_BORDER_COLOR}" />`;
      const img =
        `<image href="${exp.avatarDataUri}" x="${cx - imgOffset}" y="${cy - imgOffset}" ` +
        `width="${imgSize}" height="${imgSize}" clip-path="url(#c${i})" ` +
        `preserveAspectRatio="xMidYMid slice" />`;
      const border = `<circle cx="${cx}" cy="${cy}" r="${radius + 1}" fill="none" stroke="${AVATAR_BORDER_COLOR}" stroke-width="2" />`;
      return `${bg}\n  ${img}\n  ${border}`;
    })
    .join("\n  ");

  // Bottom pill badge with counter
  const counterSvg = buildBadgeSvg(`${finishedCount} / ${totalExpeditions}`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <image href="${backgroundDataUri}" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid slice" />
  <defs>
    ${defs}
  </defs>
  ${avatars}
  ${counterSvg}
</svg>`;
};
