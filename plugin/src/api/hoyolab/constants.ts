import type { GameId } from "@hoyodeck/shared/types";

/**
 * HoYoLAB API base URLs
 */
export const API_URLS = {
  /** Battle Chronicle API (real-time notes, spiral abyss, etc.) */
  BATTLE_CHRONICLE: "https://bbs-api-os.hoyolab.com",

  /** Enhancement calculator API */
  CALCULATOR: "https://sg-public-api.hoyolab.com",

  /** Account API */
  ACCOUNT: "https://sg-public-api.hoyolab.com",
} as const;

/**
 * Common request headers
 */
export const COMMON_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "x-rpc-app_version": "1.5.0",
  "x-rpc-client_type": "5",
  "x-rpc-language": "en-us",
  Origin: "https://act.hoyolab.com",
  Referer: "https://act.hoyolab.com/",
} as const;

/**
 * Genshin Impact specific constants
 */
export const GENSHIN = {
  /** Battle Chronicle endpoints */
  ENDPOINTS: {
    DAILY_NOTE: "/game_record/genshin/api/dailyNote",
    SPIRAL_ABYSS: "/game_record/genshin/api/spiralAbyss",
    ROLE_COMBAT: "/game_record/genshin/api/role_combat",
    HARD_CHALLENGE: "/game_record/genshin/api/hard_challenge",
    ACT_CALENDAR: "/event/game_record/genshin/api/act_calendar",
  },
} as const;

/**
 * Honkai: Star Rail specific constants
 */
export const STAR_RAIL = {
  ENDPOINTS: {
    DAILY_NOTE: "/game_record/hkrpg/api/note",
    CHALLENGE: "/game_record/hkrpg/api/challenge",
    CHALLENGE_STORY: "/game_record/hkrpg/api/challenge_story",
    CHALLENGE_BOSS: "/game_record/hkrpg/api/challenge_boss",
    CHALLENGE_PEAK: "/game_record/hkrpg/api/challenge_peak",
    ACT_CALENDAR: "/game_record/hkrpg/api/get_act_calender",
  },
} as const;

/**
 * Zenless Zone Zero specific constants
 */
export const ZZZ = {
  ENDPOINTS: {
    DAILY_NOTE: "/event/game_record_zzz/api/zzz/note",
    SHIYU_DEFENSE: "/event/game_record_zzz/api/zzz/hadal_info_v2",
    DEADLY_ASSAULT: "/event/game_record_zzz/api/zzz/mem_detail",
    GACHA_CALENDAR: "/event/game_record_zzz/api/zzz/gacha_calendar",
  },
} as const;

/**
 * Code redemption URLs per game (global/OS servers).
 * HSR uses the risk-checked POST endpoint while GI/ZZZ still use GET.
 */
export const REDEEM_URLS: Record<GameId, string> = {
  gi: "https://sg-hk4e-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey",
  hsr: "https://sg-hkrpg-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkeyRisk",
  zzz: "https://public-operation-nap.hoyoverse.com/common/apicdkey/api/webExchangeCdkey",
};

/**
 * Redemption request method per game.
 */
export const REDEEM_METHODS: Record<GameId, "GET" | "POST"> = {
  gi: "GET",
  hsr: "POST",
  zzz: "GET",
};

/**
 * Headers observed on working web redemption requests.
 * These differ from the general Battle Chronicle API headers.
 */
export const REDEEM_HEADERS = {
  "x-rpc-app_version": "2.34.1",
  "x-rpc-client_type": "4",
} as const;
