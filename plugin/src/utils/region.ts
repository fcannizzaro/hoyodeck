import type { GameId } from '@/types/games';
import { GAMES } from '@/types/games';

/**
 * Extract the region from a UID based on the first digit(s)
 */
export function getRegionFromUid(uid: string, game: GameId): string {
  const gameConfig = GAMES[game];
  const prefix = uid.charAt(0);

  // For ZZZ, use first two digits
  if (game === 'zzz') {
    const zzPrefix = uid.substring(0, 2);
    const region = gameConfig.regions[zzPrefix];
    if (region) return region;
  }

  const region = gameConfig.regions[prefix];

  if (!region) {
    // Default to USA for unknown regions
    return Object.values(gameConfig.regions)[0] ?? 'os_usa';
  }

  return region;
}

/**
 * Check if UID is for Chinese server
 */
export function isChineseServer(uid: string, game: GameId): boolean {
  const region = getRegionFromUid(uid, game);
  return region.startsWith('cn_') || region.startsWith('prod_gf_cn');
}

/**
 * Validate UID format
 */
export function isValidUid(uid: string): boolean {
  // UID should be 9-10 digits
  return /^\d{9,10}$/.test(uid);
}
