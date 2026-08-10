import type { GameId, HoyoRegion } from "@hoyodeck/shared/types";

/**
 * HoYoLAB API base URLs
 */
export const API_URLS = {
  global: {
    /** Battle Chronicle API (real-time notes, spiral abyss, etc.) */
    BATTLE_CHRONICLE: "https://bbs-api-os.hoyolab.com",
    /** Event and calculator API */
    CALCULATOR: "https://sg-public-api.hoyolab.com",
    /** Account API */
    ACCOUNT: "https://sg-public-api.hoyolab.com",
  },
  cn: {
    /** MiYouShe game-record API */
    BATTLE_CHRONICLE: "https://api-takumi-record.mihoyo.com",
    /** CN game-record event API */
    CALCULATOR: "https://api-takumi-record.mihoyo.com",
    /** MiYouShe account binding API */
    ACCOUNT: "https://api-takumi.mihoyo.com",
  },
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

/** Headers required by MiYouShe's app-style game-record endpoints. */
export const CN_COMMON_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13; M2101K9C Build/TKQ1.220829.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/108.0.5359.128 Mobile Safari/537.36 miHoYoBBS/2.70.1",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9",
  "x-rpc-app_version": "2.11.1",
  "x-rpc-client_type": "5",
  "x-rpc-language": "zh-cn",
  "X-Requested-With": "com.mihoyo.hyperion",
  Origin: "https://webstatic.mihoyo.com",
  Referer: "https://webstatic.mihoyo.com/",
} as const;

/** Return the API base URL group for a persisted account region. */
export function getApiUrls(region: HoyoRegion) {
  return API_URLS[region];
}

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
