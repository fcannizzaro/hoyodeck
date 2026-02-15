/**
 * Reward display utilities for Stream Deck keys.
 */

import { buildBadgeSvg } from './banner';

const SIZE = 144;
const ICON_SIZE = 80;
const ICON_OFFSET = (SIZE - ICON_SIZE) / 2;

/**
 * Build a 3-layer SVG for the daily reward key display.
 *
 * Layer 1: Base frame (daily.png) - golden circular background
 * Layer 2: Today's reward icon - centered within the circle
 * Layer 3: Done overlay (done.png) - green checkmark, only when claimed
 *
 * @param baseDataUri Data URI of the base frame image (daily.png)
 * @param rewardDataUri Data URI of today's reward icon (remote)
 * @param doneDataUri Data URI of the done overlay image (done.png)
 * @param claimed Whether the reward has already been claimed today
 * @param grayscaleBase Whether to render the base frame in grayscale (used for ZZZ claimed state)
 * @param badgeText Optional text to display as a bottom-center pill badge (e.g. "x60")
 * @returns SVG string suitable for Stream Deck setImage
 */
export const buildRewardSvg = (
  baseDataUri: string,
  rewardDataUri: string,
  doneDataUri: string,
  claimed: boolean,
  grayscaleBase = false,
  badgeText: string,
): string => {
  const filterDef = grayscaleBase
    ? `<defs><filter id="grayscale"><feColorMatrix type="saturate" values="0"/></filter></defs>`
    : "";

  const baseFilter = grayscaleBase ? ` filter="url(#grayscale)"` : "";

  const doneLayer = claimed
    ? `<image href="${doneDataUri}" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid slice" />`
    : "";

  const badgeLayer = claimed ? "": buildBadgeSvg(badgeText);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  ${filterDef}
  <image href="${baseDataUri}" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid slice"${baseFilter} />
  <image href="${rewardDataUri}" x="${ICON_OFFSET}" y="${ICON_OFFSET}" width="${ICON_SIZE}" height="${ICON_SIZE}" preserveAspectRatio="xMidYMid meet" style="opacity: ${claimed ? "0.6" : "1"}" />
  ${doneLayer}
  ${badgeLayer}
</svg>`;
};
