import { z } from "zod";

/**
 * V2 Authentication schema
 */
export const HoyoAuthSchema = z.object({
  ltoken_v2: z.string().min(1),
  ltuid_v2: z.string().min(1),
  ltmid_v2: z.string().min(1),
  cookie_token_v2: z.string().min(1),
  account_mid_v2: z.string().min(1),
  account_id_v2: z.string().min(1),
  /**
   * Session token (v2). Optional for backward compatibility with accounts
   * created before this field was captured. When present, enables automatic
   * refresh of the shorter-lived cookie_token_v2 used by code redemption.
   */
  stoken_v2: z.string().min(1).optional(),
});

/** Full auth — all 6 fields required for both API and code redemption */
export type HoyoAuth = z.infer<typeof HoyoAuthSchema>;

/** All fields optional — for partial cookie extraction */
export type PartialHoyoAuth = Partial<HoyoAuth>;

/** Unique account identifier (UUID v4) */
export type AccountId = string;

/** Validation status of an account's cookies */
export type AuthStatus = "unknown" | "valid" | "invalid";
