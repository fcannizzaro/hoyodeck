import type { AccountId, AuthStatus, HoyoAuth } from "./auth";
import type { GameId } from "./game";

/** HoYo account ecosystem used for API and login routing. */
export type HoyoRegion = "global" | "cn";

export interface GameRole {
  uid: string;
  nickname: string;
  region: string;
}

/** A single HoYoLAB account with per-game UIDs */
export interface HoyoAccount {
  /** Stable unique ID (UUID v4) */
  id: AccountId;
  /** User-defined display name (e.g. "Main", "Alt EU") */
  name: string;
  /** HoYoLAB (global) or MiYouShe (China). Missing on legacy accounts means global. */
  region?: HoyoRegion;
  /** Parsed HoYoLAB auth cookies */
  auth: HoyoAuth;
  /** Auth validation status (set by plugin after API call) */
  authStatus: AuthStatus;
  /** Per-game UIDs — only games the user plays are present */
  uids: Partial<Record<GameId, string>>;
  /** All discovered characters, including multiple servers for one game. */
  roles?: Partial<Record<GameId, GameRole[]>>;
  /** Nicknames of the selected per-game characters. */
  nicknames?: Partial<Record<GameId, string>>;
}

/** Account without auth credentials — used by display components */
export type HoyoAccountInfo = Omit<HoyoAccount, "auth">;
