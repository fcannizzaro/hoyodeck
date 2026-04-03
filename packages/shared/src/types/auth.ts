import { z } from "zod";

/**
 * V2 Authentication schema
 */
export const HoyoAuthSchema = z.object({
  ltoken_v2: z.string().min(1),
  ltuid_v2: z.string().min(1),
  ltmid_v2: z.string().min(1),
  cookie_token_v2: z.string().optional(),
  account_mid_v2: z.string().optional(),
  account_id_v2: z.string().optional(),
});

/** Full auth — 3 required + 3 optional fields */
export type HoyoAuth = z.infer<typeof HoyoAuthSchema>;

/** All fields optional — for partial cookie extraction */
export type PartialHoyoAuth = Partial<HoyoAuth>;

/** Unique account identifier (UUID v4) */
export type AccountId = string;

/** Validation status of an account's cookies */
export type AuthStatus = "unknown" | "valid" | "invalid";
