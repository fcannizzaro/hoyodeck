import type { AccountId, HoyoAuth } from "./auth";
import type { HoyoAccount } from "./account";
import type { GameId } from "./game";
import type { CodeRedeemResult } from "./codes";

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

// ─── Pending Login (webview login flow) ───────────────────────────

/** Transient state for the native webview login flow. PI writes 'requested'; plugin drives the rest. */
export type PendingLogin =
  | { status: "requested" }
  | { status: "polling" }
  | { status: "success"; auth: HoyoAuth }
  | { status: "cancelled" }
  | { status: "error"; message: string };

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

  /**
   * Signal for the native webview login flow.
   * PI sets 'requested'; plugin opens webview and drives the state machine.
   * PI reads the result and clears the field.
   */
  pendingLogin?: PendingLogin;

  /**
   * Locally tracked claimed/expired codes per account+game.
   * Key format: "{game}:{uid}" → array of code strings.
   * Persisted so the badge count stays correct across restarts
   * without relying on the codes-server for per-user state.
   */
  claimedCodes?: Record<string, string[]>;

  /**
   * Per-code redemption results with status and reason.
   * Key format: "{game}:{uid}" → array of CodeRedeemResult.
   * Used by the PI to display outcome details.
   */
  redeemResults?: Record<string, CodeRedeemResult[]>;

  /**
   * Wish/pity tracker data stored globally so it persists across action instances.
   * Key format: "{game}:{bannerType}" (e.g. "gi:character", "hsr:lightcone").
   */
  wishTrackers?: Record<string, WishPityData>;
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
  bannerIndex?: number;
  /** When true, run eye-blink animation even when animations are globally disabled */
  alwaysBlink?: boolean;
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
  bannerIndex?: number;
  /** When true, run eye-blink animation even when animations are globally disabled */
  alwaysBlink?: boolean;
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
  bannerIndex?: number;
  /** When true, run eye-blink animation even when animations are globally disabled */
  alwaysBlink?: boolean;
}

// ─── Endgame Action Settings ──────────────────────────────────────

/**
 * Genshin endgame mode
 */
export type GenshinEndgameMode =
  | "spiral-abyss"
  | "imaginarium-theater"
  | "stygian-onslaught"
  | "ending-soonest";

/**
 * Genshin endgame action settings (Spiral Abyss / Imaginarium Theater)
 */
export interface GenshinEndgameSettings extends GenshinActionSettings {
  mode?: GenshinEndgameMode;
  showStars?: boolean;
  showName?: boolean;
}

/**
 * Star Rail endgame mode
 */
export type StarRailEndgameMode =
  | "memory-of-chaos"
  | "pure-fiction"
  | "apocalyptic-shadow"
  | "anomaly-arbitration"
  | "ending-soonest";

/**
 * Star Rail endgame action settings (MoC / Pure Fiction / Apocalyptic Shadow)
 */
export interface StarRailEndgameSettings extends StarRailActionSettings {
  mode?: StarRailEndgameMode;
  showStars?: boolean;
  showName?: boolean;
}

/**
 * ZZZ endgame mode
 */
export type ZZZEndgameMode = "shiyu-defense" | "deadly-assault" | "ending-soonest";

/**
 * ZZZ endgame action settings (Shiyu Defense / Deadly Assault)
 */
export interface ZZZEndgameSettings extends ZZZActionSettings {
  mode?: ZZZEndgameMode;
  showStars?: boolean;
  showName?: boolean;
}

// ─── Unified Stamina Action Settings ──────────────────────────────

/**
 * Unified stamina action settings (multi-game: Resin / Trailblaze Power / Battery)
 */
export interface StaminaSettings extends GameActionSettings {
  game?: GameId;
}

// ─── Unified Endgame Action Settings ──────────────────────────────

/**
 * All endgame modes across all games
 */
export type EndgameMode = GenshinEndgameMode | StarRailEndgameMode | ZZZEndgameMode;

/**
 * Unified endgame action settings (multi-game)
 */
export interface UnifiedEndgameSettings extends GameActionSettings {
  game?: GameId;
  mode?: EndgameMode;
  showStars?: boolean;
  showName?: boolean;
}

// ─── Unified Banner Action Settings ───────────────────────────────

/**
 * All banner types across all games
 */
export type UnifiedBannerType = "character" | "weapon" | "lightcone" | "w-engine";

/**
 * Unified banner action settings (multi-game)
 */
export interface UnifiedBannerSettings extends GameActionSettings {
  game?: GameId;
  type?: UnifiedBannerType;
  bannerIndex?: number;
  /** When true, run eye-blink animation even when animations are globally disabled */
  alwaysBlink?: boolean;
}

// ─── Stamina Overview Action Settings ─────────────────────────────

/**
 * A single slot in the stamina overview dial action.
 * Pairs a game with the account to fetch stamina from.
 * Index signature required for JsonObject compatibility (stored in Stream Deck settings).
 */
export interface StaminaSlot {
  game: GameId;
  accountId: AccountId;
  [key: string]: JsonValue;
}

/**
 * Stamina overview dial action settings (encoder-only, multi-game).
 */
export interface StaminaOverviewSettings extends GameActionSettings {
  /** Configured game+account slots (up to 3) */
  slots?: StaminaSlot[];
  /** Currently focused slot index (-1 = no selection) */
  focusIndex?: number;
}

// ─── Wish Tracker Action Settings ─────────────────────────────────

/** Banner type per game for wish/pity tracking */
export type WishTrackerBannerType = "character" | "weapon" | "lightcone" | "w-engine";

/**
 * Persisted pity data for a single game+banner combination.
 * Stored in GlobalSettings so the count survives across action instances.
 */
export interface WishPityData {
  /** Current pity count (wishes since last 5-star) */
  pity: number;
  /** Whether next 5-star is guaranteed featured (won/lost 50/50 state) */
  guaranteed: boolean;
  [key: string]: JsonValue;
}

/**
 * A configured game+account slot in the wish tracker.
 * Determines which games appear in the top tab bar.
 */
export interface WishTrackerSlot {
  game: GameId;
  accountId: AccountId;
  [key: string]: JsonValue;
}

/**
 * Wish tracker dial action settings (encoder-only).
 * Pity data is stored in GlobalSettings.wishTrackers, not here.
 */
export interface WishTrackerSettings extends GameActionSettings {
  /** Configured game+account slots (up to 3) */
  slots?: WishTrackerSlot[];
  /** Index of the currently displayed slot */
  activeSlot?: number;
  /** Banner type for the active game */
  bannerType?: WishTrackerBannerType;
}

// ─── Patch Countdown Action Settings ──────────────────────────────

/**
 * A single slot in the patch countdown action.
 * Only specifies the game — the plugin auto-resolves the first available account
 * that has a UID for the game.
 * Index signature required for JsonObject compatibility (stored in Stream Deck settings).
 */
export interface PatchCountdownSlot {
  game: GameId;
  [key: string]: JsonValue;
}

/**
 * Patch countdown action settings (key + encoder, multi-game).
 */
export interface PatchCountdownSettings extends GameActionSettings {
  /** Configured game+account slots (up to 3) */
  slots?: PatchCountdownSlot[];
}

// ─── Redeem Code Action Settings ──────────────────────────────────

/**
 * Redeem code action settings (multi-game, like DailyRewardSettings)
 */
export interface RedeemCodeSettings extends GameActionSettings {
  game?: GameId;
  autoRedeem?: boolean;
}
