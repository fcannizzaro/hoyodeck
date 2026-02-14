export interface HoyoAuth {
  ltoken_v2?: string;
  ltuid_v2?: string;
  ltmid_v2?: string;
  cookie_token_v2?: string;
  account_mid_v2?: string;
  account_id_v2?: string;
}

const AUTH_KEYS = [
  'ltoken_v2',
  'ltuid_v2',
  'ltmid_v2',
  'cookie_token_v2',
  'account_mid_v2',
  'account_id_v2',
] as const;

/** Parse a raw cookie header string into key-value pairs. */
export function parseCookies(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  for (const pair of cookieString.split(';')) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;
    const key = pair.substring(0, eqIndex).trim();
    const value = pair.substring(eqIndex + 1);
    cookies[key] = value;
  }

  return cookies;
}

/** Extract HoYoLAB V2 auth tokens from a cookie string. */
export function extractAuthFromCookies(cookieString: string): HoyoAuth {
  const cookies = parseCookies(cookieString);
  const auth: HoyoAuth = {};

  for (const key of AUTH_KEYS) {
    if (cookies[key]) {
      auth[key] = cookies[key];
    }
  }

  return auth;
}

/** Check that the 3 required auth fields are present. */
export function isValidAuth(auth: HoyoAuth): boolean {
  return Boolean(auth.ltoken_v2 && auth.ltuid_v2 && auth.ltmid_v2);
}
