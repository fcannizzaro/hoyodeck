import { z } from 'zod';

/**
 * V2 Authentication schema for HoYoLAB API
 */
export const HoyoAuthSchema = z.object({
  ltoken_v2: z.string().min(1, 'ltoken_v2 is required'),
  ltuid_v2: z.string().min(1, 'ltuid_v2 is required'),
  ltmid_v2: z.string().min(1, 'ltmid_v2 is required'),
  // Optional tokens for code redemption
  cookie_token_v2: z.string().optional(),
  account_mid_v2: z.string().optional(),
  account_id_v2: z.string().optional(),
});

export type HoyoAuth = z.infer<typeof HoyoAuthSchema>;

/**
 * Global plugin settings
 */
export interface GlobalSettings {
  auth?: HoyoAuth;
  uid?: string;
}

/**
 * Parse V2 cookies from a cookie string
 */
export function parseCookies(cookieString: string): Partial<HoyoAuth> {
  const cookies: Partial<HoyoAuth> = {};
  const pairs = cookieString.split(';').map((s) => s.trim());

  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    const value = valueParts.join('=');

    if (!key || !value) continue;

    switch (key.trim()) {
      case 'ltoken_v2':
        cookies.ltoken_v2 = value;
        break;
      case 'ltuid_v2':
        cookies.ltuid_v2 = value;
        break;
      case 'ltmid_v2':
        cookies.ltmid_v2 = value;
        break;
      case 'cookie_token_v2':
        cookies.cookie_token_v2 = value;
        break;
      case 'account_mid_v2':
        cookies.account_mid_v2 = value;
        break;
      case 'account_id_v2':
        cookies.account_id_v2 = value;
        break;
    }
  }

  return cookies;
}

/**
 * Build a cookie string from auth object
 */
export function buildCookieString(auth: HoyoAuth): string {
  const cookies = [
    `ltoken_v2=${auth.ltoken_v2}`,
    `ltuid_v2=${auth.ltuid_v2}`,
    `ltmid_v2=${auth.ltmid_v2}`,
  ];

  if (auth.cookie_token_v2) {
    cookies.push(`cookie_token_v2=${auth.cookie_token_v2}`);
  }
  if (auth.account_mid_v2) {
    cookies.push(`account_mid_v2=${auth.account_mid_v2}`);
  }
  if (auth.account_id_v2) {
    cookies.push(`account_id_v2=${auth.account_id_v2}`);
  }

  return cookies.join('; ');
}

/**
 * Validate auth object
 */
export function validateAuth(auth: unknown): HoyoAuth {
  return HoyoAuthSchema.parse(auth);
}

/**
 * Check if auth is valid (has all required fields)
 */
export function isValidAuth(auth: unknown): auth is HoyoAuth {
  return HoyoAuthSchema.safeParse(auth).success;
}
