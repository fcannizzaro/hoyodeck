// Re-export auth types and utilities from shared package
export type { HoyoAuth, PartialHoyoAuth } from "@hoyodeck/shared/types";
export { HoyoAuthSchema } from "@hoyodeck/shared/types";

export {
  parseCookies,
  extractAuthFromCookies,
  isValidAuth,
  buildCookieString,
  validateAuth,
} from "@hoyodeck/shared/cookies";
