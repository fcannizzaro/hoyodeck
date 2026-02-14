import type { HoyoAuth } from './auth';
import { buildCookieString } from './auth';
import { generateDS } from './ds';
import { API_URLS, COMMON_HEADERS, GENSHIN, STAR_RAIL, ZZZ } from './constants';
import { type ApiResponse, HoyolabApiError, isSuccess } from '../types/common';
import type {
  GenshinDailyNote,
  GenshinSpiralAbyss,
  GenshinCheckInInfo,
  GenshinCheckInRewards,
  GenshinCheckInClaim,
  GenshinActCalendar,
} from '../types/genshin';
import type {
  StarRailDailyNote,
  StarRailActCalendar,
} from '../types/starrail';
import { getRegionFromUid } from '../../utils/region';
import { cache, CacheTTL, buildCacheKey } from '../../services/cache';

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
    const region = getRegionFromUid(uid, 'genshin');

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
    const region = getRegionFromUid(uid, 'genshin');

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
   * Get Genshin daily check-in info
   */
  async getGenshinCheckInInfo(): Promise<GenshinCheckInInfo> {
    return this.request<GenshinCheckInInfo>(
      API_URLS.CHECK_IN,
      '/event/sol/info',
      {
        query: {
          act_id: GENSHIN.CHECK_IN_ACT_ID,
          lang: 'en-us',
        },
        useDS: false,
      }
    );
  }

  /**
   * Get Genshin daily check-in rewards list
   */
  async getGenshinCheckInRewards(): Promise<GenshinCheckInRewards> {
    return this.request<GenshinCheckInRewards>(
      API_URLS.CHECK_IN,
      '/event/sol/home',
      {
        query: {
          act_id: GENSHIN.CHECK_IN_ACT_ID,
          lang: 'en-us',
        },
        useDS: false,
      }
    );
  }

  /**
   * Claim Genshin daily check-in reward
   */
  async claimGenshinCheckIn(): Promise<GenshinCheckInClaim> {
    return this.request<GenshinCheckInClaim>(
      API_URLS.CHECK_IN,
      '/event/sol/sign',
      {
        method: 'POST',
        query: {
          act_id: GENSHIN.CHECK_IN_ACT_ID,
          lang: 'en-us',
        },
        useDS: false,
      }
    );
  }

  /**
   * Get Genshin act calendar (active banner pools, events, etc.)
   */
  async getGenshinActCalendar(uid: string): Promise<GenshinActCalendar> {
    const cacheKey = buildCacheKey('genshin', 'act-calendar', uid);
    const cached = cache.get<GenshinActCalendar>(cacheKey);

    if (cached) {
      return cached;
    }

    const region = getRegionFromUid(uid, 'genshin');

    const data = await this.request<GenshinActCalendar>(
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

    cache.set(cacheKey, data, CacheTTL.STATIC);
    return data;
  }

  // ============================================
  // Honkai: Star Rail APIs
  // ============================================

  /**
   * Get Star Rail daily note (trailblaze power, assignments, etc.)
   */
  async getStarRailDailyNote(uid: string): Promise<StarRailDailyNote> {
    const region = getRegionFromUid(uid, 'starrail');

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
    const cacheKey = buildCacheKey('starrail', 'act-calendar', uid);
    const cached = cache.get<StarRailActCalendar>(cacheKey);

    if (cached) {
      return cached;
    }

    const region = getRegionFromUid(uid, 'starrail');

    const data = await this.request<StarRailActCalendar>(
      API_URLS.BATTLE_CHRONICLE,
      STAR_RAIL.ENDPOINTS.ACT_CALENDAR,
      {
        query: {
          role_id: uid,
          server: region,
        },
      }
    );

    cache.set(cacheKey, data, CacheTTL.STATIC);
    return data;
  }

  // ============================================
  // Zenless Zone Zero APIs
  // ============================================

  /**
   * Get ZZZ daily note (battery, scratch card, etc.)
   */
  async getZZZDailyNote(uid: string): Promise<unknown> {
    const region = getRegionFromUid(uid, 'zzz');

    return this.request<unknown>(
      API_URLS.BATTLE_CHRONICLE,
      ZZZ.ENDPOINTS.DAILY_NOTE,
      {
        query: {
          role_id: uid,
          server: region,
        },
      }
    );
  }
}
