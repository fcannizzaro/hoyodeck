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
