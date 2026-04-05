import type { GameId } from "@hoyodeck/shared/types";
import type { GenshinActCalendar } from "@/api/types/genshin";
import type { StarRailActCalendar } from "@/api/types/hsr";
import type { ZZZGachaCalendar } from "@/api/types/zzz";

/** Patch info extracted from a game's calendar data */
export interface PatchInfo {
  /** Current game version string (e.g. "5.4") */
  version: string;
  /** Seconds remaining until the current version ends */
  remainingSeconds: number;
}

/**
 * Extract patch end info from Genshin Impact act calendar.
 *
 * Finds the current version by looking at active banner pools,
 * then returns the latest end_timestamp among all pools in that version.
 */
function getGenshinPatchInfo(calendar: GenshinActCalendar): PatchInfo | null {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const allPools = [...calendar.avatar_card_pool_list, ...calendar.weapon_card_pool_list];

  // Find active pools (currently running banners)
  const activePools = allPools.filter((pool) => {
    const start = Number(pool.start_timestamp);
    const end = Number(pool.end_timestamp);
    return nowSeconds >= start && nowSeconds <= end;
  });

  if (activePools.length === 0) return null;

  const version = activePools[0]!.version_name;

  // Latest end among all pools for this version = approximate patch end
  const versionPools = allPools.filter((p) => p.version_name === version);
  const latestEndSeconds = Math.max(...versionPools.map((p) => Number(p.end_timestamp)));
  const remaining = Math.max(0, latestEndSeconds - nowSeconds);

  return { version, remainingSeconds: remaining };
}

/**
 * Extract patch end info from Star Rail act calendar.
 *
 * Uses `cur_game_version` provided directly by the API,
 * then finds the latest end_ts among matching pools.
 */
function getStarRailPatchInfo(calendar: StarRailActCalendar): PatchInfo | null {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const version = calendar.cur_game_version;
  const allPools = [...calendar.avatar_card_pool_list, ...calendar.equip_card_pool_list];

  const versionPools = allPools.filter((p) => p.version === version);
  if (versionPools.length === 0) return null;

  const latestEndSeconds = Math.max(...versionPools.map((p) => Number(p.time_info.end_ts)));
  const remaining = Math.max(0, latestEndSeconds - nowSeconds);

  return { version, remainingSeconds: remaining };
}

/**
 * Extract patch end info from ZZZ gacha calendar.
 *
 * Finds the current version from active gacha events,
 * then returns the latest end_ts among all events in that version.
 */
function getZZZPatchInfo(calendar: ZZZGachaCalendar): PatchInfo | null {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const allEvents = [
    ...calendar.avatar_gacha_schedule_list,
    ...calendar.weapon_gacha_schedule_list,
  ];

  // Find active events
  const activeEvents = allEvents.filter(
    (event) => nowSeconds >= event.start_ts && nowSeconds <= event.end_ts,
  );

  if (activeEvents.length === 0) return null;

  const version = activeEvents[0]!.version;
  const versionEvents = allEvents.filter((e) => e.version === version);
  const latestEndSeconds = Math.max(...versionEvents.map((e) => e.end_ts));
  const remaining = Math.max(0, latestEndSeconds - nowSeconds);

  return { version, remainingSeconds: remaining };
}

/**
 * Extract patch countdown info from any game's calendar response.
 *
 * @param game - Which game this calendar belongs to
 * @param calendarData - Raw calendar response (game-specific shape)
 * @returns PatchInfo with version + remaining seconds, or null if no active data
 */
export function getPatchInfo(game: GameId, calendarData: unknown): PatchInfo | null {
  try {
    switch (game) {
      case "gi":
        return getGenshinPatchInfo(calendarData as GenshinActCalendar);
      case "hsr":
        return getStarRailPatchInfo(calendarData as StarRailActCalendar);
      case "zzz":
        return getZZZPatchInfo(calendarData as ZZZGachaCalendar);
    }
  } catch {
    return null;
  }
}
