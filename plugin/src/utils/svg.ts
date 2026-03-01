/**
 * Encode a raw SVG string as a base64 data URI safe for Stream Deck setImage().
 *
 * Uses Buffer for proper UTF-8 → base64 encoding.  The built-in `btoa()`
 * maps each JS char-code to a single byte (Latin-1), which produces byte
 * sequences that are invalid UTF-8 for any non-ASCII character (e.g. the
 * middle-dot `·` U+00B7 in the endgame timer badge).  The XML/SVG parser
 * on the Stream Deck side expects UTF-8, so the document fails to parse
 * and the key shows a blank image.
 */
export const svgToBase64 = (svg: string): string =>
  `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
