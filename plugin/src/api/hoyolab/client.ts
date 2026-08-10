import type { HoyoAuth } from "./auth";
import { buildCookieString } from "./auth";
import { randomUUID } from "node:crypto";
import { generateCnCheckInDS, generateDS } from "./ds";
import {
  CN_COMMON_HEADERS,
  COMMON_HEADERS,
  GENSHIN,
  STAR_RAIL,
  ZZZ,
  REDEEM_HEADERS,
  REDEEM_METHODS,
  REDEEM_URLS,
  getApiUrls,
} from "./constants";
import { type ApiResponse, HoyolabApiError, isSuccess } from "../types/common";
import type {
  GenshinDailyNote,
  GenshinSpiralAbyss,
  GenshinActCalendar,
  GenshinImaginariumTheater,
  GenshinStygianOnslaught,
} from "../types/genshin";
import type { CheckInInfo, CheckInRewards, CheckInClaim } from "../types/check-in";
import type {
  StarRailDailyNote,
  StarRailActCalendar,
  StarRailChallenge,
  StarRailChallengePeak,
} from "../types/hsr";
import type {
  ZZZDailyNote,
  ZZZGachaCalendar,
  ZZZShiyuDefense,
  ZZZDeadlyAssault,
} from "../types/zzz";
import type { GameRecordCardResponse, MiyousheGameRolesResponse } from "../types/game-record";
import { getRegionFromUid } from "@/utils/region";
import type { GameId, HoyoRegion } from "@hoyodeck/shared/types";
import { getGameConfig } from "@hoyodeck/shared/games";

interface CheckInRequest {
  baseUrl: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
}

/**
 * HoYoLAB API client
 */
export class HoyolabClient {
  private readonly cookieString: string;
  private readonly deviceId = randomUUID();
  private readonly apiUrls: ReturnType<typeof getApiUrls>;

  constructor(
    auth: HoyoAuth,
    private readonly region: HoyoRegion = "global",
  ) {
    this.cookieString = buildCookieString(auth);
    this.apiUrls = getApiUrls(region);
  }

  /**
   * Make an authenticated request to HoYoLAB API
   */
  private async request<T>(
    baseUrl: string,
    endpoint: string,
    options: {
      method?: "GET" | "POST";
      query?: Record<string, string>;
      body?: Record<string, unknown>;
      useDS?: boolean;
      headers?: Record<string, string>;
    } = {},
  ): Promise<T> {
    const { method = "GET", query, body, useDS = true } = options;

    // Build URL with query parameters
    let url = `${baseUrl}${endpoint}`;
    if (query) {
      const params = new URLSearchParams(query);
      url += `?${params.toString()}`;
    }

    // Build headers
    const baseHeaders = this.region === "cn" ? CN_COMMON_HEADERS : COMMON_HEADERS;
    const headers: Record<string, string> = {
      ...baseHeaders,
      Cookie: this.cookieString,
      ...options.headers,
    };

    if (this.region === "cn") {
      headers["x-rpc-device_id"] = this.deviceId;
    }

    if (useDS) {
      headers.DS = generateDS(this.region, query, body);
    }

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const requestBody = body
      ? JSON.stringify(
          Object.fromEntries(
            Object.entries(body).sort(([left], [right]) => left.localeCompare(right)),
          ),
        )
      : undefined;

    // Make request
    const response = await fetch(url, {
      method,
      headers,
      body: requestBody,
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

  /** Add MiYouShe's `/app` path segment for GI/HSR record endpoints. */
  private recordEndpoint(endpoint: string): string {
    if (this.region !== "cn") return endpoint;
    return endpoint
      .replace("/game_record/genshin/", "/game_record/app/genshin/")
      .replace("/game_record/hkrpg/", "/game_record/app/hkrpg/");
  }

  /** Build region-specific daily check-in routing, params, and headers. */
  private getCheckInRequest(game: GameId, uid?: string): CheckInRequest {
    const config = getGameConfig(game);

    if (this.region === "cn") {
      if (!uid) throw new Error("A game UID is required for CN daily check-in");

      return {
        baseUrl: config.cnCheckInBaseUrl,
        path: config.cnCheckInPath,
        query: {
          act_id: config.cnCheckInActId,
          uid,
          region: getRegionFromUid(uid, game),
        },
        headers: {
          "x-rpc-signgame": config.signGameHeader,
          "x-rpc-app_version": "2.70.1",
          "x-rpc-client_type": "5",
          "x-rpc-sys_version": "12",
          "x-rpc-platform": "android",
          "x-rpc-channel": "miyousheluodi",
          DS: generateCnCheckInDS(),
        },
      };
    }

    return {
      baseUrl: config.checkInBaseUrl,
      path: config.checkInPath,
      query: { act_id: config.checkInActId, lang: "en-us" },
      headers: { "x-rpc-signgame": config.signGameHeader },
    };
  }

  // ============================================
  // Genshin Impact APIs
  // ============================================

  /**
   * Get Genshin daily note (resin, commissions, expeditions, etc.)
   */
  async getGenshinDailyNote(uid: string): Promise<GenshinDailyNote> {
    const region = getRegionFromUid(uid, "gi");

    return this.request<GenshinDailyNote>(
      this.apiUrls.BATTLE_CHRONICLE,
      this.recordEndpoint(GENSHIN.ENDPOINTS.DAILY_NOTE),
      {
        query: {
          role_id: uid,
          server: region,
        },
      },
    );
  }

  /**
   * Get Genshin Spiral Abyss data
   */
  async getGenshinSpiralAbyss(uid: string, scheduleType: 1 | 2 = 1): Promise<GenshinSpiralAbyss> {
    const region = getRegionFromUid(uid, "gi");

    return this.request<GenshinSpiralAbyss>(
      this.apiUrls.BATTLE_CHRONICLE,
      this.recordEndpoint(GENSHIN.ENDPOINTS.SPIRAL_ABYSS),
      {
        query: {
          role_id: uid,
          server: region,
          schedule_type: String(scheduleType),
        },
      },
    );
  }

  /**
   * Get Genshin Imaginarium Theater data
   */
  async getGenshinImaginariumTheater(uid: string): Promise<GenshinImaginariumTheater> {
    const region = getRegionFromUid(uid, "gi");

    return this.request<GenshinImaginariumTheater>(
      this.apiUrls.BATTLE_CHRONICLE,
      this.recordEndpoint(GENSHIN.ENDPOINTS.ROLE_COMBAT),
      {
        query: {
          role_id: uid,
          server: region,
          need_detail: "false",
        },
      },
    );
  }

  /**
   * Get Genshin Stygian Onslaught data
   */
  async getGenshinStygianOnslaught(uid: string): Promise<GenshinStygianOnslaught> {
    const region = getRegionFromUid(uid, "gi");

    return this.request<GenshinStygianOnslaught>(
      this.apiUrls.BATTLE_CHRONICLE,
      this.recordEndpoint(GENSHIN.ENDPOINTS.HARD_CHALLENGE),
      {
        query: {
          role_id: uid,
          server: region,
          need_detail: "true",
        },
      },
    );
  }

  /**
   * Get daily check-in status for any game
   * @param game - The game to check status for
   */
  async getCheckInInfo(game: GameId, uid?: string): Promise<CheckInInfo> {
    const checkIn = this.getCheckInRequest(game, uid);
    return this.request<CheckInInfo>(checkIn.baseUrl, `${checkIn.path}/info`, {
      query: checkIn.query,
      useDS: false,
      headers: checkIn.headers,
    });
  }

  /**
   * Get daily check-in rewards list for any game
   * @param game - The game to get rewards for
   */
  async getCheckInRewards(game: GameId, uid?: string): Promise<CheckInRewards> {
    const checkIn = this.getCheckInRequest(game, uid);
    return this.request<CheckInRewards>(checkIn.baseUrl, `${checkIn.path}/home`, {
      query: checkIn.query,
      useDS: false,
      headers: checkIn.headers,
    });
  }

  /**
   * Claim daily check-in reward for any game
   * @param game - The game to claim reward for
   */
  async claimCheckIn(game: GameId, uid?: string): Promise<CheckInClaim> {
    const checkIn = this.getCheckInRequest(game, uid);
    return this.request<CheckInClaim>(checkIn.baseUrl, `${checkIn.path}/sign`, {
      method: "POST",
      query: checkIn.query,
      useDS: false,
      headers: checkIn.headers,
    });
  }

  /**
   * Get Genshin act calendar (active banner pools, events, etc.)
   */
  async getGenshinActCalendar(uid: string): Promise<GenshinActCalendar> {
    const region = getRegionFromUid(uid, "gi");

    return this.request<GenshinActCalendar>(
      this.apiUrls.CALCULATOR,
      GENSHIN.ENDPOINTS.ACT_CALENDAR,
      {
        method: "POST",
        query: {
          role_id: uid,
          server: region,
        },
        useDS: this.region === "cn",
      },
    );
  }

  // ============================================
  // Honkai: Star Rail APIs
  // ============================================

  /**
   * Get Star Rail daily note (trailblaze power, assignments, etc.)
   */
  async getStarRailDailyNote(uid: string): Promise<StarRailDailyNote> {
    const region = getRegionFromUid(uid, "hsr");

    return this.request<StarRailDailyNote>(
      this.apiUrls.BATTLE_CHRONICLE,
      this.recordEndpoint(STAR_RAIL.ENDPOINTS.DAILY_NOTE),
      {
        query: {
          role_id: uid,
          server: region,
        },
      },
    );
  }

  /**
   * Get Star Rail act calendar (active banner pools, events, etc.)
   */
  async getStarRailActCalendar(uid: string): Promise<StarRailActCalendar> {
    const region = getRegionFromUid(uid, "hsr");

    return this.request<StarRailActCalendar>(
      this.apiUrls.BATTLE_CHRONICLE,
      this.recordEndpoint(STAR_RAIL.ENDPOINTS.ACT_CALENDAR),
      {
        query: {
          role_id: uid,
          server: region,
        },
      },
    );
  }

  /**
   * Get Star Rail Memory of Chaos data
   */
  async getStarRailMemoryOfChaos(uid: string): Promise<StarRailChallenge> {
    const region = getRegionFromUid(uid, "hsr");

    return this.request<StarRailChallenge>(
      this.apiUrls.BATTLE_CHRONICLE,
      this.recordEndpoint(STAR_RAIL.ENDPOINTS.CHALLENGE),
      {
        query: {
          role_id: uid,
          server: region,
          schedule_type: "1",
          need_all: "true",
        },
      },
    );
  }

  /**
   * Get Star Rail Pure Fiction data
   */
  async getStarRailPureFiction(uid: string): Promise<StarRailChallenge> {
    const region = getRegionFromUid(uid, "hsr");

    return this.request<StarRailChallenge>(
      this.apiUrls.BATTLE_CHRONICLE,
      this.recordEndpoint(STAR_RAIL.ENDPOINTS.CHALLENGE_STORY),
      {
        query: {
          role_id: uid,
          server: region,
          schedule_type: "1",
          need_all: "true",
        },
      },
    );
  }

  /**
   * Get Star Rail Apocalyptic Shadow data
   */
  async getStarRailApocalypticShadow(uid: string): Promise<StarRailChallenge> {
    const region = getRegionFromUid(uid, "hsr");

    return this.request<StarRailChallenge>(
      this.apiUrls.BATTLE_CHRONICLE,
      this.recordEndpoint(STAR_RAIL.ENDPOINTS.CHALLENGE_BOSS),
      {
        query: {
          role_id: uid,
          server: region,
          schedule_type: "1",
          need_all: "true",
        },
      },
    );
  }

  /**
   * Get Star Rail Anomaly Arbitration data
   */
  async getStarRailAnomalyArbitration(uid: string): Promise<StarRailChallengePeak> {
    const region = getRegionFromUid(uid, "hsr");

    return this.request<StarRailChallengePeak>(
      this.apiUrls.BATTLE_CHRONICLE,
      this.recordEndpoint(STAR_RAIL.ENDPOINTS.CHALLENGE_PEAK),
      {
        query: {
          role_id: uid,
          server: region,
          schedule_type: "1",
        },
      },
    );
  }

  // ============================================
  // Zenless Zone Zero APIs
  // ============================================

  /**
   * Get ZZZ daily note (battery, scratch card, etc.)
   */
  async getZZZDailyNote(uid: string): Promise<ZZZDailyNote> {
    const region = getRegionFromUid(uid, "zzz");

    return this.request<ZZZDailyNote>(this.apiUrls.CALCULATOR, ZZZ.ENDPOINTS.DAILY_NOTE, {
      query: {
        role_id: uid,
        server: region,
      },
    });
  }

  /**
   * Get ZZZ gacha calendar (active signal search banners)
   *
   * Note: This endpoint uses `uid`/`region` query params (not `role_id`/`server`)
   * per the upstream API specification.
   */
  async getZZZGachaCalendar(uid: string): Promise<ZZZGachaCalendar> {
    const region = getRegionFromUid(uid, "zzz");

    return this.request<ZZZGachaCalendar>(this.apiUrls.CALCULATOR, ZZZ.ENDPOINTS.GACHA_CALENDAR, {
      query: {
        uid,
        region,
      },
    });
  }

  /**
   * Get ZZZ Shiyu Defense data.
   * The raw response wraps the data under a versioned key (hadal_info_v1 or hadal_info_v2).
   */
  async getZZZShiyuDefense(uid: string): Promise<ZZZShiyuDefense> {
    const region = getRegionFromUid(uid, "zzz");

    const raw = await this.request<Record<string, unknown>>(
      this.apiUrls.CALCULATOR,
      ZZZ.ENDPOINTS.SHIYU_DEFENSE,
      {
        query: {
          role_id: uid,
          server: region,
          schedule_type: "1",
        },
      },
    );

    // Response is wrapped: { hadal_ver: "v1"|"v2", hadal_info_v2: {...}, ... }
    const version = (raw.hadal_ver as string) ?? "v2";
    return raw[`hadal_info_${version}`] as ZZZShiyuDefense;
  }

  /**
   * Get ZZZ Deadly Assault data.
   * This endpoint uses uid/region params (not role_id/server).
   */
  async getZZZDeadlyAssault(uid: string): Promise<ZZZDeadlyAssault> {
    const region = getRegionFromUid(uid, "zzz");

    return this.request<ZZZDeadlyAssault>(this.apiUrls.CALCULATOR, ZZZ.ENDPOINTS.DEADLY_ASSAULT, {
      query: {
        uid,
        region,
        schedule_type: "1",
      },
    });
  }

  // ============================================
  // Account APIs
  // ============================================

  /**
   * Get game record card — lists all linked games with UIDs and nicknames.
   * Uses the HoYoLAB account UID (ltuid_v2), not an in-game UID.
   */
  async getGameRecordCard(ltuid: string): Promise<GameRecordCardResponse> {
    if (this.region === "cn") {
      const response = await this.request<MiyousheGameRolesResponse>(
        this.apiUrls.ACCOUNT,
        "/binding/api/getUserGameRolesByCookie",
      );
      const gameIds: Record<string, number> = {
        hk4e_cn: 2,
        hkrpg_cn: 6,
        nap_cn: 8,
      };

      return {
        list: response.list
          .filter((role) => gameIds[role.game_biz] !== undefined)
          .map((role) => ({
            has_role: true,
            game_id: gameIds[role.game_biz]!,
            game_role_id: role.game_uid,
            nickname: role.nickname,
            region: role.region,
            level: role.level,
          })),
      };
    }

    return this.request<GameRecordCardResponse>(
      this.apiUrls.ACCOUNT,
      "/event/game_record/card/wapi/getGameRecordCard",
      {
        query: { uid: ltuid },
      },
    );
  }

  // ============================================
  // Code Redemption APIs
  // ============================================

  /**
   * Redeem a gift code for a specific game and UID.
   * @param game - The game to redeem for
   * @param code - The redemption code string
   * @param uid - The player's in-game UID
   * @throws {HoyolabApiError} If redemption fails (already claimed, expired, etc.)
   */
  async redeemCode(game: GameId, code: string, uid: string): Promise<void> {
    if (this.region === "cn") {
      throw new Error("Gift-code redemption is not available through MiYouShe; redeem in-game");
    }

    const redeemUrl = REDEEM_URLS[game];
    if (!redeemUrl) throw new Error(`No redemption URL for game: ${game}`);
    const method = REDEEM_METHODS[game];

    const region = getRegionFromUid(uid, game);
    const gameBiz: Record<GameId, string> = {
      gi: "hk4e_global",
      hsr: "hkrpg_global",
      zzz: "nap_global",
    };

    const payload = {
      uid,
      region,
      cdkey: code,
      game_biz: gameBiz[game],
      lang: "en",
    };

    await this.request<unknown>(redeemUrl, "", {
      method,
      query: method === "GET" ? payload : undefined,
      body: method === "POST" ? payload : undefined,
      useDS: false,
      headers: REDEEM_HEADERS,
    });
  }
}
