/**
 * Banner formatting utilities
 */

import { readLocalImageAsDataUri } from "./image";

const BACKGROUNDS = {
  genshin: readLocalImageAsDataUri("imgs/actions/gi/5-star.webp"),
  hsr: readLocalImageAsDataUri("imgs/actions/hsr/5-star.png"),
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
const BAR_HEIGHT = 40;
const BAR_MARGIN = 0;
const FONT_SIZE = 20;

/**
 * Build an SVG string for the banner key display.
 * Composes a background image with semi-transparent text bars at top and bottom.
 * @param imageDataUri Base64 data URI of the featured character/weapon icon
 * @param countdown Remaining time string (bottom bar)
 * @returns SVG string suitable for Stream Deck setImage
 */
export const buildBannerSvg = (
  imageDataUri: string,
  countdown: string,
  game: "genshin" | "hsr",
): string => {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <image href="${BACKGROUNDS[game]}" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid slice" />
  <image href="${imageDataUri}" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid slice" />
  <rect x="${BAR_MARGIN}" y="${SIZE - BAR_MARGIN - BAR_HEIGHT}" width="${SIZE - BAR_MARGIN * 2}" height="${BAR_HEIGHT}" rx="6" fill="black" style="opacity: 0.7" />
  <text x="${SIZE / 2}" y="${SIZE - BAR_MARGIN - BAR_HEIGHT / 2 + FONT_SIZE / 3}" font-family="sans-serif" font-size="${FONT_SIZE}" font-weight="bold" fill="white" text-anchor="middle">${countdown}</text>
</svg>`;
};
