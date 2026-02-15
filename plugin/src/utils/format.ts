/**
 * Format a number with thousand separators
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Format stamina display (e.g., "120/200")
 */
export function formatStamina(current: number, max: number): string {
  return `${current}/${max}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 1) + '...';
}
