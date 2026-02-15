import {
  HoyoAuthSchema,
  type HoyoAuth,
  type PartialHoyoAuth,
} from "../types/auth";

/** Auth field keys to extract from cookies */
const AUTH_KEYS: (keyof HoyoAuth)[] = [
  "ltoken_v2",
  "ltuid_v2",
  "ltmid_v2",
  "cookie_token_v2",
  "account_mid_v2",
  "account_id_v2",
];

/**
 * Extract auth-related fields from a parsed cookie record.
 * Returns a partial auth object — use isValidAuth to check completeness.
 */
export function extractAuthFromCookies(
  cookies: Record<string, string>,
): PartialHoyoAuth {
  const auth: PartialHoyoAuth = {};

  for (const key of AUTH_KEYS) {
    if (cookies[key]) {
      auth[key] = cookies[key];
    }
  }

  return auth;
}

/**
 * Check if auth is valid (has all required fields).
 * Acts as a type guard narrowing to HoyoAuth.
 */
export function isValidAuth(auth: unknown): auth is HoyoAuth {
  return HoyoAuthSchema.safeParse(auth).success;
}

/**
 * Build a cookie string from an auth object.
 */
export function buildCookieString(auth: HoyoAuth): string {
  const cookies = [
    `ltoken_v2=${auth.ltoken_v2}`,
    `ltuid_v2=${auth.ltuid_v2}`,
    `ltmid_v2=${auth.ltmid_v2}`,
  ];

  return cookies.join("; ");
}

/**
 * Validate auth object, throwing on failure.
 */
export function validateAuth(auth: unknown): HoyoAuth {
  return HoyoAuthSchema.parse(auth);
}
