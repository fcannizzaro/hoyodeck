/**
 * Supported game identifiers
 */
export type GameId = "gi" | "hsr" | "zzz";

/**
 * Full game configuration
 */
export interface GameConfig {
  id: GameId;
  name: string;
  staminaMax: number;
  staminaField: string;
  staminaName: string;
  dailyNoteEndpoint: string;
  checkInActId: string;
  checkInBaseUrl: string;
  checkInPath: string;
  signGameHeader: string;
  regions: Record<string, string>;
}
