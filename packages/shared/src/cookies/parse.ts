/**
 * Parse a raw cookie header string into key-value pairs.
 * Handles both `; ` and `;` separators, trims whitespace.
 */
export function parseCookies(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  for (const pair of cookieString.split(";")) {
    const eqIndex = pair.indexOf("=");
    if (eqIndex === -1) continue;

    const key = pair.substring(0, eqIndex).trim();
    const value = pair.substring(eqIndex + 1);

    if (key && value) {
      cookies[key] = value;
    }
  }

  return cookies;
}
