import type { GameId } from "./game";

/** Status of a code relative to a specific account */
type CodeStatus = "available" | "claimed" | "dismissed" | "expired";

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
