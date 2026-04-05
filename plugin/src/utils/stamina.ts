import type { GameId } from "@hoyodeck/shared/types";
import { GAMES } from "@hoyodeck/shared/games";
import type { GenshinDailyNote } from "@/api/types/genshin";
import type { StarRailDailyNote } from "@/api/types/hsr";
import type { ZZZDailyNote } from "@/api/types/zzz";

/** Normalized stamina data extracted from any game's daily note */
export interface StaminaInfo {
  current: number;
  max: number;
  /** Seconds until full recovery (0 = already full) */
  recoverySeconds: number;
}

/**
 * Extract normalized stamina data from a game-specific daily note response.
 *
 * Each game stores stamina differently:
 * - GI: `current_resin` / `resin_recovery_time` (string seconds)
 * - HSR: `current_stamina` / `stamina_recover_time` (number seconds)
 * - ZZZ: `energy.progress.current` / `energy.restore` (number seconds)
 *
 * Returns `null` if extraction fails (unexpected shape, API change, etc.).
 */
export function extractStamina(game: GameId, dailyNote: unknown): StaminaInfo | null {
  const max = GAMES[game].staminaMax;

  try {
    switch (game) {
      case "gi": {
        const note = dailyNote as GenshinDailyNote;
        return {
          current: note.current_resin,
          max,
          recoverySeconds: parseInt(note.resin_recovery_time, 10) || 0,
        };
      }
      case "hsr": {
        const note = dailyNote as StarRailDailyNote;
        return {
          current: note.current_stamina,
          max,
          recoverySeconds: note.stamina_recover_time,
        };
      }
      case "zzz": {
        const note = dailyNote as ZZZDailyNote;
        return {
          current: note.energy.progress.current,
          max,
          recoverySeconds: note.energy.restore,
        };
      }
    }
  } catch {
    return null;
  }
}

/**
 * Format recovery time as a compact human-readable string.
 * e.g. "2h 30m", "45m", "Full"
 */
export function formatRecoveryTime(seconds: number): string {
  if (seconds <= 0) return "Full";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
