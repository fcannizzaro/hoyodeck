import { z } from 'zod';
import { HoyoAuthSchema } from '../../types/settings';

export type { HoyoAuth } from '../../types/settings';
export { HoyoAuthSchema } from '../../types/settings';

/**
 * Parse V2 cookies from a cookie string
 */
export function parseCookies(
  cookieString: string,
): Partial<z.infer<typeof HoyoAuthSchema>> {
  const cookies: Record<string, string> = {};
  const pairs = cookieString.split(';').map((s) => s.trim());

  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    const value = valueParts.join('=');

    if (!key || !value) continue;

    const trimmedKey = key.trim();
    if (
      [
        'ltoken_v2',
        'ltuid_v2',
        'ltmid_v2',
        'cookie_token_v2',
        'account_mid_v2',
        'account_id_v2',
      ].includes(trimmedKey)
    ) {
      cookies[trimmedKey] = value;
    }
  }

  return cookies as Partial<z.infer<typeof HoyoAuthSchema>>;
}

/**
 * Build a cookie string from auth object
 */
export function buildCookieString(
  auth: z.infer<typeof HoyoAuthSchema>,
): string {
  const cookies = [
    `ltoken_v2=${auth.ltoken_v2}`,
    `ltuid_v2=${auth.ltuid_v2}`,
    `ltmid_v2=${auth.ltmid_v2}`,
  ];

  return cookies.join('; ');
}

/**
 * Validate auth object
 */
export function validateAuth(
  auth: unknown,
): z.infer<typeof HoyoAuthSchema> {
  return HoyoAuthSchema.parse(auth);
}

/**
 * Check if auth is valid (has all required fields)
 */
export function isValidAuth(
  auth: unknown,
): auth is z.infer<typeof HoyoAuthSchema> {
  return HoyoAuthSchema.safeParse(auth).success;
}
