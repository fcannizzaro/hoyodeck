/**
 * Expedition display utilities for Stream Deck keys.
 *
 * Two-zone layout on a 144x144 SVG canvas:
 *   - Top: horizontal row of circular character avatars
 *   - Bottom: brown box with "X/Y" counter (completed in orange, total in white)
 */

const SIZE = 144;
const AVATAR_R = 18;
const AVATAR_IMG_SCALE = 1.1;

/** Top zone for avatars */
const TOP_ZONE_HEIGHT = 90;
const AVATAR_CY = TOP_ZONE_HEIGHT / 2;

/** Bottom zone for counter */
const BAR_HEIGHT = 28;
const BAR_RX = 8;
const BAR_PADDING_X = 6;
const COUNTER_FONT_SIZE = 20;
const CHAR_WIDTH = COUNTER_FONT_SIZE * 0.65;
const BAR_Y = SIZE - BAR_HEIGHT;
const TEXT_Y = BAR_Y + BAR_HEIGHT / 2 + COUNTER_FONT_SIZE / 3;

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
 * Build the expedition display SVG for a Stream Deck 144x144 key.
 *
 * Layers (back to front):
 *   1. Background image
 *   2. Top zone: row of circular avatars
 *   3. Bottom zone: brown box with completed/total counter
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

  // Compute avatar horizontal positions (evenly spaced)
  const avatarSpacing = SIZE / (count + 1);
  const avatarPositions = Array.from({ length: count }, (_, i) => ({
    cx: Math.round(avatarSpacing * (i + 1)),
    cy: AVATAR_CY,
  }));

  // Clip paths for circular avatars
  const defs = avatarPositions
    .map(
      (pos, i) =>
        `<clipPath id="c${i}"><circle cx="${pos.cx}" cy="${pos.cy}" r="${AVATAR_R}" /></clipPath>`,
    )
    .join("\n    ");

  // Avatar images
  const imgSize = Math.round(AVATAR_R * 2 * AVATAR_IMG_SCALE);
  const imgOffset = imgSize / 2;

  const avatars = expeditions
    .map((exp, i) => {
      const { cx, cy } = avatarPositions[i]!;
      const bg = `<circle cx="${cx}" cy="${cy}" r="${AVATAR_R}" fill="#6B4226" />`;
      const img =
        `<image href="${exp.avatarDataUri}" x="${cx - imgOffset}" y="${cy - imgOffset}" ` +
        `width="${imgSize}" height="${imgSize}" clip-path="url(#c${i})" ` +
        `preserveAspectRatio="xMidYMid slice" />`;
      const border = `<circle cx="${cx}" cy="${cy}" r="${AVATAR_R + 1}" fill="none" stroke="#6B4226" stroke-width="2" />`;
      return `${bg}\n  ${img}\n  ${border}`;
    })
    .join("\n  ");

  // Bottom zone: pill with counter
  const counterLabel = `${finishedCount} / ${totalExpeditions}`;
  const barW = Math.round(counterLabel.length * CHAR_WIDTH + BAR_PADDING_X * 2);
  const barX = Math.round((SIZE - barW) / 2);

  const counterBox = `<rect x="${barX}" y="${BAR_Y}" width="${barW}" height="${BAR_HEIGHT + BAR_RX}" rx="${BAR_RX}" fill="black" opacity="0.5" />`;

  const counterText = `<text x="${SIZE / 2}" y="${TEXT_Y}" fill="white" font-family="sans-serif" font-size="${COUNTER_FONT_SIZE}" text-anchor="middle" font-weight="bold" xml:space="preserve">${finishedCount} / ${totalExpeditions}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <image href="${backgroundDataUri}" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid slice" />
  <defs>
    ${defs}
  </defs>
  ${avatars}
  ${counterBox}
  ${counterText}
</svg>`;
};
