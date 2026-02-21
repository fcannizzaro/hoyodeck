import type { HoyoAuth } from './auth';
import { buildCookieString } from './auth';
import { generateDS } from './ds';
import { API_URLS, COMMON_HEADERS, GENSHIN, STAR_RAIL, ZZZ } from './constants';
import { type ApiResponse, HoyolabApiError, isSuccess } from '../types/common';
import type {
  GenshinDailyNote,
  GenshinSpiralAbyss,
  GenshinActCalendar,
} from '../types/genshin';
import type {
  CheckInInfo,
  CheckInRewards,
  CheckInClaim,
} from '../types/check-in';
import type {
  StarRailDailyNote,
  StarRailActCalendar,
} from '../types/hsr';
import type {
  ZZZDailyNote,
  ZZZGachaCalendar,
} from '../types/zzz';
import type { GameRecordCardResponse } from '../types/game-record';
import { getRegionFromUid } from '@/utils/region';
import { type GameId, getGameConfig } from '@/types/games';

/**
 * HoYoLAB API client with V2 authentication
 */
export class HoyolabClient {
  private readonly cookieString: string;

  constructor(private readonly auth: HoyoAuth) {
    this.cookieString = buildCookieString(auth);
  }

  /**
   * Make an authenticated request to HoYoLAB API
   */
  private async request<T>(
    baseUrl: string,
    endpoint: string,
    options: {
      method?: 'GET' | 'POST';
      query?: Record<string, string>;
      body?: Record<string, unknown>;
      useDS?: boolean;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const { method = 'GET', query, body, useDS = true } = options;

    // Build URL with query parameters
    let url = `${baseUrl}${endpoint}`;
    if (query) {
      const params = new URLSearchParams(query);
      url += `?${params.toString()}`;
    }

    // Build headers
    const headers: Record<string, string> = {
      ...COMMON_HEADERS,
      Cookie: this.cookieString,
      ...options.headers,
    };

    if (useDS) {
      headers['DS'] = generateDS();
    }

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    // Make request
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = (await response.json()) as ApiResponse<T>;

    if (!isSuccess(json)) {
      throw new HoyolabApiError(json.retcode, json.message);
    }

    return json.data;
  }

  // ============================================
  // Genshin Impact APIs
  // ============================================

  /**
   * Get Genshin daily note (resin, commissions, expeditions, etc.)
   */
  async getGenshinDailyNote(uid: string): Promise<GenshinDailyNote> {
    const region = getRegionFromUid(uid, 'gi');

    return this.request<GenshinDailyNote>(
      API_URLS.BATTLE_CHRONICLE,
      GENSHIN.ENDPOINTS.DAILY_NOTE,
      {
        query: {
          role_id: uid,
          server: region,
        },
      }
    );
  }

  /**
   * Get Genshin Spiral Abyss data
   */
  async getGenshinSpiralAbyss(
    uid: string,
    scheduleType: 1 | 2 = 1
  ): Promise<GenshinSpiralAbyss> {
    const region = getRegionFromUid(uid, 'gi');

    return this.request<GenshinSpiralAbyss>(
      API_URLS.BATTLE_CHRONICLE,
      GENSHIN.ENDPOINTS.SPIRAL_ABYSS,
      {
        query: {
          role_id: uid,
          server: region,
          schedule_type: String(scheduleType),
        },
      }
    );
  }

  /**
   * Get daily check-in status for any game
   * @param game - The game to check status for
   */
  async getCheckInInfo(game: GameId): Promise<CheckInInfo> {
    const config = getGameConfig(game);
    return this.request<CheckInInfo>(
      config.checkInBaseUrl,
      `${config.checkInPath}/info`,
      {
        query: {
          act_id: config.checkInActId,
          lang: 'en-us',
        },
        useDS: false,
        headers: { 'x-rpc-signgame': config.signGameHeader },
      }
    );
  }

  /**
   * Get daily check-in rewards list for any game
   * @param game - The game to get rewards for
   */
  async getCheckInRewards(game: GameId): Promise<CheckInRewards> {
    const config = getGameConfig(game);
    return this.request<CheckInRewards>(
      config.checkInBaseUrl,
      `${config.checkInPath}/home`,
      {
        query: {
          act_id: config.checkInActId,
          lang: 'en-us',
        },
        useDS: false,
        headers: { 'x-rpc-signgame': config.signGameHeader },
      }
    );
  }

  /**
   * Claim daily check-in reward for any game
   * @param game - The game to claim reward for
   */
  async claimCheckIn(game: GameId): Promise<CheckInClaim> {
    const config = getGameConfig(game);
    return this.request<CheckInClaim>(
      config.checkInBaseUrl,
      `${config.checkInPath}/sign`,
      {
        method: 'POST',
        query: {
          act_id: config.checkInActId,
          lang: 'en-us',
        },
        useDS: false,
        headers: { 'x-rpc-signgame': config.signGameHeader },
      }
    );
  }

  /**
   * Get Genshin act calendar (active banner pools, events, etc.)
   */
  async getGenshinActCalendar(uid: string): Promise<GenshinActCalendar> {
    const region = getRegionFromUid(uid, 'gi');

    return this.request<GenshinActCalendar>(
      API_URLS.CALCULATOR,
      GENSHIN.ENDPOINTS.ACT_CALENDAR,
      {
        method: 'POST',
        query: {
          role_id: uid,
          server: region,
        },
        useDS: false,
      }
    );
  }

  // ============================================
  // Honkai: Star Rail APIs
  // ============================================

  /**
   * Get Star Rail daily note (trailblaze power, assignments, etc.)
   */
  async getStarRailDailyNote(uid: string): Promise<StarRailDailyNote> {
    const region = getRegionFromUid(uid, 'hsr');

    return this.request<StarRailDailyNote>(
      API_URLS.BATTLE_CHRONICLE,
      STAR_RAIL.ENDPOINTS.DAILY_NOTE,
      {
        query: {
          role_id: uid,
          server: region,
        },
      }
    );
  }

  /**
   * Get Star Rail act calendar (active banner pools, events, etc.)
   */
  async getStarRailActCalendar(uid: string): Promise<StarRailActCalendar> {
    const region = getRegionFromUid(uid, 'hsr');

    return this.request<StarRailActCalendar>(
      API_URLS.BATTLE_CHRONICLE,
      STAR_RAIL.ENDPOINTS.ACT_CALENDAR,
      {
        query: {
          role_id: uid,
          server: region,
        },
      }
    );
  }

  // ============================================
  // Zenless Zone Zero APIs
  // ============================================

  /**
   * Get ZZZ daily note (battery, scratch card, etc.)
   */
  async getZZZDailyNote(uid: string): Promise<ZZZDailyNote> {
    const region = getRegionFromUid(uid, 'zzz');

    return this.request<ZZZDailyNote>(
      API_URLS.CALCULATOR,
      ZZZ.ENDPOINTS.DAILY_NOTE,
      {
        query: {
          role_id: uid,
          server: region,
        },
      }
    );
  }

  /**
   * Get ZZZ gacha calendar (active signal search banners)
   *
   * Note: This endpoint uses `uid`/`region` query params (not `role_id`/`server`)
   * per the upstream API specification.
   */
  async getZZZGachaCalendar(uid: string): Promise<ZZZGachaCalendar> {
    const region = getRegionFromUid(uid, 'zzz');

    return this.request<ZZZGachaCalendar>(
      API_URLS.CALCULATOR,
      ZZZ.ENDPOINTS.GACHA_CALENDAR,
      {
        query: {
          uid,
          region,
        },
      }
    );
  }

  // ============================================
  // Account APIs
  // ============================================

  /**
   * Get game record card — lists all linked games with UIDs and nicknames.
   * Uses the HoYoLAB account UID (ltuid_v2), not an in-game UID.
   */
  async getGameRecordCard(ltuid: string): Promise<GameRecordCardResponse> {
    return this.request<GameRecordCardResponse>(
      API_URLS.ACCOUNT,
      '/event/game_record/card/wapi/getGameRecordCard',
      {
        query: { uid: ltuid },
      }
    );
  }
}
