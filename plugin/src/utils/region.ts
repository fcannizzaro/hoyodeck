import type { GameId } from "@hoyodeck/shared/types";
import { GAMES } from "@hoyodeck/shared/games";

/**
 * Extract the region from a UID based on the first digit(s)
 */
export function getRegionFromUid(uid: string, game: GameId): string {
  const gameConfig = GAMES[game];

  // CN ZZZ UIDs currently have eight digits; global UIDs have ten.
  if (game === "zzz") {
    if (uid.length === 8) return "prod_gf_cn";

    const region = gameConfig.regions[uid.slice(0, -8)];
    if (region) return region;
  }

  // GI can now have ten-digit Asia UIDs (18xxxxxxxx), so use every
  // digit before the final eight-digit account number as the prefix.
  const prefix = uid.slice(0, -8);
  const region = gameConfig.regions[prefix];

  if (!region) {
    const globalFallbacks: Record<GameId, string> = {
      gi: "os_usa",
      hsr: "prod_official_usa",
      zzz: "prod_gf_us",
    };
    return globalFallbacks[game];
  }

  return region;
}
