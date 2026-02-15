/**
 * Banner formatting utilities
 */

import { readLocalImageAsDataUri } from "./image";
import type { BannerBadgeOptions } from "@/types/settings";

const BACKGROUNDS = {
  gi: readLocalImageAsDataUri("imgs/actions/gi/5-star.webp"),
  hsr: readLocalImageAsDataUri("imgs/actions/hsr/5-star.png"),
  zzz: readLocalImageAsDataUri("imgs/actions/zzz/5-star.png"),
};

/**
 * Format countdown from remaining seconds
 * @param seconds Remaining seconds until banner ends
 * @returns Formatted string like "5d 3h" or "Ended"
 */
export const formatCountdownFromSeconds = (seconds: number): string => {
  if (seconds <= 0) return "Ended";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);

  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
};

/**
 * Format countdown to banner end
 * @param endDate Banner end date
 * @returns Formatted string like "5d 3h" or "Ended"
 */
export const formatBannerCountdown = (endDate: Date): string => {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
};

/**
 * Truncate banner name for display on Stream Deck key
 * @param maxLength Maximum characters to display
 * @returns Truncated string with ellipsis if needed
 */
export const truncateBannerName = (
  name: string,
  maxLength: number = 16,
): string => {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 2) + "..";
};

const SIZE = 144;
const DEFAULT_FONT_SIZE = 18;
const BADGE_RX = 10;
const BADGE_PADDING_X = 10;
const BADGE_MARGIN = 6;

const DEFAULT_BADGE: BannerBadgeOptions = {
  position: "center",
  layout: "horizontal",
  fontSize: DEFAULT_FONT_SIZE,
};

/**
 * Compute dynamic badge dimensions from font size.
 */
const getBadgeDimensions = (fontSize: number) => {
  const charWidth = fontSize * 0.65;
  const badgeHeight = Math.round(fontSize * 1.55);
  return { charWidth, badgeHeight };
};

/**
 * Build the badge SVG elements for horizontal layout.
 * Badge sits along the bottom edge, positioned left/center/right.
 */
const buildHorizontalBadge = (
  text: string,
  position: BannerBadgeOptions["position"],
  fontSize: number,
): string => {
  const { charWidth, badgeHeight } = getBadgeDimensions(fontSize);
  const badgeW = Math.round(text.length * charWidth + BADGE_PADDING_X * 2);

  let badgeX: number;
  switch (position) {
    case "left":
      badgeX = BADGE_MARGIN;
      break;
    case "right":
      badgeX = SIZE - badgeW - BADGE_MARGIN;
      break;
    default:
      badgeX = Math.round((SIZE - badgeW) / 2);
  }

  const badgeY = SIZE - badgeHeight - BADGE_MARGIN;
  const textX = badgeX + badgeW / 2;
  const textY = badgeY + badgeHeight / 2 + fontSize / 3;

  return `<rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeHeight}" rx="${BADGE_RX}" fill="black" opacity="0.7" />
  <text x="${textX}" y="${textY}" font-family="sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle">${text}</text>`;
};

/**
 * Build the badge SVG elements for vertical layout.
 * Badge sits along a side edge with text rotated -90°.
 * Position controls which side: left → left edge, right → right edge, center → left edge.
 */
const buildVerticalBadge = (
  text: string,
  position: BannerBadgeOptions["position"],
  fontSize: number,
): string => {
  const { charWidth, badgeHeight } = getBadgeDimensions(fontSize);
  const badgeW = Math.round(text.length * charWidth + BADGE_PADDING_X * 2);

  // Center of the badge on the canvas
  const cx =
    position === "right"
      ? SIZE - BADGE_MARGIN - badgeHeight / 2
      : BADGE_MARGIN + badgeHeight / 2;
  const cy = SIZE / 2;

  // Draw the badge centered at origin, then translate + rotate into position
  const halfW = badgeW / 2;
  const halfH = badgeHeight / 2;

  return `<g transform="translate(${cx}, ${cy}) rotate(-90)">
    <rect x="${-halfW}" y="${-halfH}" width="${badgeW}" height="${badgeHeight}" rx="${BADGE_RX}" fill="black" opacity="0.7" />
    <text x="0" y="${fontSize / 3}" font-family="sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle">${text}</text>
  </g>`;
};

/** Y-coordinate of the badge top edge at default font size on a 144×144 canvas */
export const BADGE_TOP_Y =
  SIZE - getBadgeDimensions(DEFAULT_FONT_SIZE).badgeHeight - BADGE_MARGIN;

/**
 * Build a centered floating pill badge SVG fragment.
 * Reusable across all action SVG builders.
 * @param text Badge label
 * @returns SVG string containing <rect> + <text> elements
 */
export const buildBadgeSvg = (text: string): string => {
  return buildHorizontalBadge(text, "center", DEFAULT_FONT_SIZE);
};

/**
 * Build an SVG string for the banner key display.
 * Composes a background image with a rounded pill badge showing the countdown.
 * @param imageDataUri Base64 data URI of the featured character/weapon icon
 * @param countdown Remaining time string
 * @param game Game identifier for background selection
 * @param badge Optional badge position and layout options
 * @returns SVG string suitable for Stream Deck setImage
 */
export const buildBannerSvg = (
  imageDataUri: string,
  countdown: string,
  game: "gi" | "hsr" | "zzz",
  badge?: BannerBadgeOptions,
): string => {
  const { position, layout, fontSize } = badge ?? DEFAULT_BADGE;
  const height = game === "gi" ? SIZE : 169;
  const y = game === "gi" ? 0 : -12;

  const badgeSvg =
    layout === "vertical"
      ? buildVerticalBadge(countdown, position, fontSize)
      : buildHorizontalBadge(countdown, position, fontSize);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <image href="${BACKGROUNDS[game]}" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid slice" />
  <image href="${imageDataUri}" x="0" y="${y}" width="${SIZE}" height="${height}" preserveAspectRatio="xMidYMid slice" />
  ${badgeSvg}
</svg>`;
};
