import { z } from "zod";
import type { JsonObject, JsonValue } from "@elgato/utils";
import type { GameId } from "./games";

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

export type HoyoAuth = z.infer<typeof HoyoAuthSchema>;

// ─── Multi-Account Types ──────────────────────────────────────────

/** Unique account identifier (UUID v4) */
export type AccountId = string;

/** Validation status of an account's cookies */
export type AuthStatus = "unknown" | "valid" | "invalid";

/** A single HoYoLAB account with per-game UIDs */
export interface HoyoAccount {
  /** Stable unique ID (UUID v4) */
  id: AccountId;
  /** User-defined display name (e.g. "Main", "Alt EU") */
  name: string;
  /** Parsed HoYoLAB auth cookies */
  auth: HoyoAuth;
  /** Auth validation status (set by plugin after API call) */
  authStatus: AuthStatus;
  /** Per-game UIDs — only games the user plays are present */
  uids: Partial<Record<GameId, string>>;
}

// ─── Global Settings ──────────────────────────────────────────────

/**
 * Global plugin settings stored by Stream Deck (V2 — multi-account)
 */
export interface GlobalSettings {
  /** Schema version for migration detection */
  version?: 2;
  /** All configured accounts, keyed by AccountId */
  accounts?: Record<AccountId, HoyoAccount>;
  /**
   * Signal from PI to Plugin: "please validate this account's auth".
   * Plugin clears this after processing.
   */
  pendingValidation?: AccountId;

  // V1 legacy fields (present only before migration)
  /** @deprecated V1 single auth — used for migration only */
  auth?: HoyoAuth;
  /** @deprecated V1 single UID — used for migration only */
  uid?: string;
}

/** Cast GlobalSettings to JsonObject for SDK calls */
export function toJsonObject(settings: GlobalSettings): JsonObject {
  return settings as unknown as JsonObject;
}

// ─── Per-Action Settings ──────────────────────────────────────────

/**
 * Base settings shared by all actions
 */
export interface GameActionSettings {
  /** Selected account ID for this action instance */
  accountId?: AccountId;
  [key: string]: JsonValue;
}

/**
 * Base settings for Genshin actions
 */
export type GenshinActionSettings = GameActionSettings;

/**
 * Banner action settings
 */
export interface BannerSettings extends GenshinActionSettings {
  type?: "character" | "weapon";
}

/**
 * Daily reward action settings
 */
export interface DailyRewardSettings extends GenshinActionSettings {
  claimOnClick?: boolean;
}

/**
 * Transformer action settings
 */
export interface TransformerSettings extends GenshinActionSettings {
  style?: "icon" | "text";
}

/**
 * Base settings for Star Rail actions
 */
export type StarRailActionSettings = GameActionSettings;

/**
 * Star Rail Banner action settings
 */
export interface StarRailBannerSettings extends StarRailActionSettings {
  type?: "character" | "lightcone";
}
