import type { AccountId, AuthStatus, HoyoAuth } from "./auth";
import type { GameId } from "./game";

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
  /** Per-game nicknames — auto-fetched from game record card */
  nicknames?: Partial<Record<GameId, string>>;
}

/** Account without auth credentials — used by display components */
export type HoyoAccountInfo = Omit<HoyoAccount, "auth">;
