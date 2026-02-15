/**
 * HoYoLAB API base URLs
 */
export const API_URLS = {
  /** Battle Chronicle API (real-time notes, spiral abyss, etc.) */
  BATTLE_CHRONICLE: 'https://bbs-api-os.hoyolab.com',

  /** Enhancement calculator API */
  CALCULATOR: 'https://sg-public-api.hoyolab.com',

  /** Account API */
  ACCOUNT: 'https://sg-public-api.hoyolab.com',
} as const;

/**
 * Common request headers
 */
export const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'x-rpc-app_version': '1.5.0',
  'x-rpc-client_type': '5',
  'x-rpc-language': 'en-us',
  Origin: 'https://act.hoyolab.com',
  Referer: 'https://act.hoyolab.com/',
} as const;

/**
 * Genshin Impact specific constants
 */
export const GENSHIN = {
  /** Daily check-in activity ID */
  CHECK_IN_ACT_ID: 'e202102251931481',

  /** Battle Chronicle endpoints */
  ENDPOINTS: {
    DAILY_NOTE: '/game_record/genshin/api/dailyNote',
    SPIRAL_ABYSS: '/game_record/genshin/api/spiralAbyss',
    INDEX: '/game_record/genshin/api/index',
    CHARACTERS: '/game_record/genshin/api/character',
    ACT_CALENDAR: '/event/game_record/genshin/api/act_calendar',
  },
} as const;

/**
 * Honkai: Star Rail specific constants (for future use)
 */
export const STAR_RAIL = {
  CHECK_IN_ACT_ID: 'e202303301540311',
  ENDPOINTS: {
    DAILY_NOTE: '/game_record/hkrpg/api/note',
    FORGOT_HALL: '/game_record/hkrpg/api/challenge',
    ACT_CALENDAR: '/game_record/hkrpg/api/get_act_calender',
  },
} as const;

/**
 * Zenless Zone Zero specific constants (for future use)
 */
export const ZZZ = {
  CHECK_IN_ACT_ID: 'e202406031448091',
  ENDPOINTS: {
    DAILY_NOTE: '/event/game_record_zzz/api/zzz/note',
    GACHA_CALENDAR: '/event/game_record_zzz/api/zzz/gacha_calendar',
  },
} as const;
