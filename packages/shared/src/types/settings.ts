import type { AccountId } from "./auth";
import type { HoyoAccount } from "./account";
import type { GameId } from "./game";

// ─── JSON Types (Stream Deck SDK compat) ──────────────────────────

/** JSON primitive value */
type JsonPrimitive = boolean | number | string | null | undefined;

/** JSON value */
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

// ─── Banner Badge Options ─────────────────────────────────────────

/** Badge position on the key */
export type BannerBadgePosition = "left" | "center" | "right";

/** Badge layout orientation */
export type BannerBadgeLayout = "horizontal" | "vertical";

/** Options passed to the banner SVG builder for badge rendering */
export interface BannerBadgeOptions {
  position: BannerBadgePosition;
  layout: BannerBadgeLayout;
  fontSize: number;
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

  /** Banner badge position: left, center, or right */
  bannerBadgePosition?: BannerBadgePosition;
  /** Banner badge layout: horizontal (bottom edge) or vertical (side edge) */
  bannerBadgeLayout?: BannerBadgeLayout;
  /** Banner badge font size (default 18) */
  bannerBadgeFontSize?: number;

  /** When true, animated actions render a single static frame instead of looping */
  disableAnimations?: boolean;
}

// ─── Per-Action Settings ──────────────────────────────────────────

/**
 * Base settings shared by all actions.
 * Includes index signature for Stream Deck SDK JsonObject compatibility.
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
export interface DailyRewardSettings extends GameActionSettings {
  game?: GameId;
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

/**
 * Base settings for ZZZ actions
 */
export type ZZZActionSettings = GameActionSettings;

/**
 * ZZZ Banner action settings
 */
export interface ZZZBannerSettings extends ZZZActionSettings {
  type?: "character" | "w-engine";
}
