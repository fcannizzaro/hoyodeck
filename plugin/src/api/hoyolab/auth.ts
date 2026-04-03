// Re-export auth types and utilities from shared package
export type { HoyoAuth } from "@hoyodeck/shared/types";

export {
  extractAuthFromCookies,
  isValidAuth,
  buildCookieString,
  validateAuth,
} from "@hoyodeck/shared/cookies";
