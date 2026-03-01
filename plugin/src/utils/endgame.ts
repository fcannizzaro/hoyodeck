/**
 * Endgame SVG builder
 * Shared across GI, HSR, and ZZZ endgame actions
 *
 * Layout (144x144):
 *   |  ┌─────────────┐ |     <- rounded pill, single-line mode name (marquee)
 *   |  └─────────────┘ |
 *   |      36*          |     <- dark box, full width, centered star count
 *   |                   |
 *   |    [5 days]       |     <- bottom badge
 *   +-------------------+
 */

const SIZE = 144;

/**
 * Compute the y position for visually centered text in a box.
 * Accounts for the baseline offset of sans-serif fonts (~0.35em).
 */
const centeredTextY = (boxY: number, boxH: number, fontSize: number): number =>
  Math.round(boxY + boxH / 2 + fontSize * 0.35);

// -- Name label (rounded pill, single-line, top area) -----------------

const NAME_FONT = 14;
const NAME_CHAR_WIDTH = NAME_FONT * 0.6;
const NAME_PADDING_X = 10;
const NAME_PADDING_Y = 6;
const NAME_MARGIN_TOP = 6;
const NAME_MARGIN_X = 6;
const NAME_RX = 10;

/** Maximum pill width (with horizontal margin from edges). */
const NAME_MAX_PILL_W = SIZE - NAME_MARGIN_X * 2;

/** Maximum text width inside the pill. */
const NAME_MAX_INNER_W = NAME_MAX_PILL_W - NAME_PADDING_X * 2;

/** Separator between repeated text in the infinite scroll. */
const NAME_SEPARATOR = ' - ';

/**
 * Returns the cycle width for infinite scrolling (0 = text fits, no scroll).
 * Cycle width = one full "Name - " segment in px.
 */
export function getNameCycleWidth(name: string): number {
  const textW = name.length * NAME_CHAR_WIDTH;
  if (textW <= NAME_MAX_INNER_W) return 0;
  return Math.round((name.length + NAME_SEPARATOR.length) * NAME_CHAR_WIDTH);
}

interface NameLabelResult {
  svg: string;
  bottomY: number;
}

/**
 * Build the mode name pill. Single line; if the text overflows,
 * a repeated "Name - Name - ..." string scrolls infinitely.
 */
const buildNameLabel = (name: string, scrollOffset: number): NameLabelResult => {
  const textW = name.length * NAME_CHAR_WIDTH;
  const fits = textW <= NAME_MAX_INNER_W;

  const pillH = NAME_FONT + NAME_PADDING_Y * 2;
  const pillY = NAME_MARGIN_TOP;
  const textY = centeredTextY(pillY, pillH, NAME_FONT);

  let svg = '';

  if (fits) {
    // Static — centered pill that shrinks to text width
    const pillW = Math.round(textW + NAME_PADDING_X * 2);
    const pillX = Math.round((SIZE - pillW) / 2);

    svg += `<rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${NAME_RX}" fill="black" opacity="0.7" />`;
    svg += `\n  <text x="${SIZE / 2}" y="${textY}" font-family="sans-serif" font-size="${NAME_FONT}" font-weight="bold" fill="white" text-anchor="middle">${name}</text>`;
  } else {
    // Scrolling — pill extends edge-to-edge, no rounded corners
    const pillX = 0;
    const pillW = SIZE;

    svg += `<defs><clipPath id="nc"><rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" /></clipPath></defs>`;
    svg += `<rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" fill="black" opacity="0.7" />`;

    const segment = `${name}${NAME_SEPARATOR}`;
    const segmentW = segment.length * NAME_CHAR_WIDTH;
    const copies = Math.ceil(pillW / segmentW) + 1;
    const scrollText = segment.repeat(copies);
    const baseX = pillX + NAME_PADDING_X - scrollOffset;
    svg += `\n  <text x="${baseX}" y="${textY}" font-family="sans-serif" font-size="${NAME_FONT}" font-weight="bold" fill="white" text-anchor="start" clip-path="url(#nc)">${scrollText}</text>`;
  }

  return { svg, bottomY: pillY + pillH };
};

// -- Star box (full width, vertically centered in available space) ----

const STAR_FONT = 52;
const STAR_PADDING_Y = 10;

/**
 * Build the star count box, vertically centered between topY and bottomY.
 */
const buildStarBox = (text: string, topY: number, bottomY: number): string => {
  const cx = SIZE / 2;
  const boxH = STAR_FONT + STAR_PADDING_Y * 1;
  const centerY = Math.round((topY + bottomY) / 2);
  const boxY = Math.round(centerY - boxH / 2);
  const textY = centeredTextY(boxY, boxH, STAR_FONT) + 1;

  return `<rect x="0" y="${boxY}" width="${SIZE}" height="${boxH}" fill="black" opacity="0.25" />
  <text x="${cx}" y="${textY}" font-family="sans-serif" font-size="${STAR_FONT}" font-weight="bold" fill="black" text-anchor="middle" stroke="black" stroke-width="5">${text}</text>
  <text x="${cx}" y="${textY}" font-family="sans-serif" font-size="${STAR_FONT}" font-weight="bold" fill="white" text-anchor="middle">${text}</text>`;
};

// -- Timer badge (bottom center) --------------------------------------

const TIMER_FONT = 18;
const TIMER_HEIGHT = 26;
const TIMER_MARGIN_BOTTOM = 8;
const TIMER_RX = 10;

const buildTimerBadge = (text: string): string => {
  const charWidth = TIMER_FONT * 0.6;
  const paddingX = 10;
  const badgeW = Math.round(text.length * charWidth + paddingX * 2);
  const badgeX = Math.round((SIZE - badgeW) / 2);
  const badgeY = SIZE - TIMER_HEIGHT - TIMER_MARGIN_BOTTOM;
  const cx = SIZE / 2;
  const textY = centeredTextY(badgeY, TIMER_HEIGHT, TIMER_FONT);

  return `<rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${TIMER_HEIGHT}" rx="${TIMER_RX}" fill="black" opacity="0.7" />
  <text x="${cx}" y="${textY}" font-family="sans-serif" font-size="${TIMER_FONT}" font-weight="bold" fill="white" text-anchor="middle">${text}</text>`;
};

// -- Public API -------------------------------------------------------

/**
 * Build an SVG for endgame mode display.
 *
 * @param bgDataUri      Background image data URI
 * @param progressText   Star/score display (e.g. "36*")
 * @param timerText      Days remaining (e.g. "5 days")
 * @param modeName       Full mode name shown at the top (e.g. "Spiral Abyss")
 * @param showStars      Whether to render the star box (default true)
 * @param showName       Whether to render the mode name label (default true)
 * @param scrollOffset   Horizontal scroll offset in px for the mode name marquee (default 0)
 * @returns Raw SVG string
 */
export function buildEndgameSvg(
  bgDataUri: string,
  progressText: string,
  timerText: string,
  modeName: string,
  showStars = true,
  showName = true,
  scrollOffset = 0,
): string {
  const GAP = 4;
  const nameResult = showName ? buildNameLabel(modeName, scrollOffset) : null;
  const timerTop = SIZE - TIMER_HEIGHT - TIMER_MARGIN_BOTTOM;

  const starAreaTop = nameResult ? nameResult.bottomY + GAP : NAME_MARGIN_TOP;
  const starAreaBottom = timerTop - GAP;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <image href="${bgDataUri}" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="xMidYMid slice" />
  ${showStars ? buildStarBox(progressText, starAreaTop, starAreaBottom) : ''}
  ${nameResult?.svg ?? ''}
  ${buildTimerBadge(timerText)}
</svg>`;
}
