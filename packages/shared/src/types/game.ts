import { z } from "zod";

/**
 * Supported game identifiers
 */
export type GameId = "gi" | "hsr" | "zzz";

export const GameIdSchema = z.enum(["gi", "hsr", "zzz"]);

/**
 * Full game configuration
 */
export interface GameConfig {
  id: GameId;
  name: string;
  battleChronicleUrl: string;
  cnBattleChronicleUrl: string;
  loginButtonSelector?: string;
  staminaMax: number;
  staminaField: string;
  staminaName: string;
  dailyNoteEndpoint: string;
  checkInActId: string;
  checkInBaseUrl: string;
  checkInPath: string;
  cnCheckInActId: string;
  cnCheckInBaseUrl: string;
  cnCheckInPath: string;
  signGameHeader: string;
  regions: Record<string, string>;
}
