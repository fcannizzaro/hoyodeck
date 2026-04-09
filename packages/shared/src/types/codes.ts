import type { GameId } from "./game";

/** Status of a code relative to a specific account */
export type CodeStatus = "available" | "claimed" | "dismissed" | "expired";

/** Live redemption progress for a single code */
export type CodeRedeemProgress = "pending" | "loading" | "success" | "error";

/** Outcome status for a redeemed code (persisted to globalSettings) */
export type CodeRedeemStatus = "success" | "already_claimed" | "expired" | "error";

/** Persisted result for a single code after redemption attempt */
export interface CodeRedeemResult {
  /** The code string */
  code: string;
  /** Outcome of the redemption attempt */
  status: CodeRedeemStatus;
  /** Human-readable reason (API message or fallback) */
  reason: string;
  /** ISO 8601 timestamp of the attempt */
  redeemedAt: string;
}

/** A redeemable game code from the crawler */
interface GameCode {
  /** The code string itself (e.g. "GENSHINGIFT") */
  code: string;
  /** Which game this code belongs to */
  game: GameId;
  /** Human-readable reward description */
  rewards: string;
  /** ISO 8601 timestamp when code was first discovered */
  discoveredAt: string;
  /** Whether the upstream source reports the code as active */
  active: boolean;
}

/**
 * A code with account-specific claim status,
 * returned by the manager's list endpoint.
 */
export interface GameCodeWithStatus extends GameCode {
  status: CodeStatus;
}
