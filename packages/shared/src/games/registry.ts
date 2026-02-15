import type { GameConfig, GameId } from "../types/game";

/**
 * Game registry - extensible for future games
 */
export const GAMES: Record<GameId, GameConfig> = {
  gi: {
    id: "gi",
    name: "Genshin Impact",
    staminaMax: 200,
    staminaField: "current_resin",
    staminaName: "Resin",
    dailyNoteEndpoint: "/game_record/genshin/api/dailyNote",
    checkInActId: "e202102251931481",
    checkInBaseUrl: "https://sg-hk4e-api.hoyolab.com",
    checkInPath: "/event/sol",
    signGameHeader: "hk4e",
    regions: {
      "1": "cn_gf01",
      "2": "cn_gf01",
      "5": "cn_qd01",
      "6": "os_usa",
      "7": "os_euro",
      "8": "os_asia",
      "9": "os_cht",
    },
  },
  hsr: {
    id: "hsr",
    name: "Honkai: Star Rail",
    staminaMax: 300,
    staminaField: "current_stamina",
    staminaName: "Trailblaze Power",
    dailyNoteEndpoint: "/game_record/hkrpg/api/note",
    checkInActId: "e202303301540311",
    checkInBaseUrl: "https://sg-public-api.hoyolab.com",
    checkInPath: "/event/luna/hkrpg/os",
    signGameHeader: "hkrpg",
    regions: {
      "1": "prod_gf_cn",
      "2": "prod_gf_cn",
      "5": "prod_qd_cn",
      "6": "prod_official_usa",
      "7": "prod_official_eur",
      "8": "prod_official_asia",
      "9": "prod_official_cht",
    },
  },
  zzz: {
    id: "zzz",
    name: "Zenless Zone Zero",
    staminaMax: 240,
    staminaField: "energy",
    staminaName: "Battery",
    dailyNoteEndpoint: "/event/game_record_zzz/api/zzz/note",
    checkInActId: "e202406031448091",
    checkInBaseUrl: "https://sg-public-api.hoyolab.com",
    checkInPath: "/event/luna/zzz/os",
    signGameHeader: "zzz",
    regions: {
      "10": "prod_gf_us",
      "13": "prod_gf_jp",
      "15": "prod_gf_eu",
      "17": "prod_gf_sg",
    },
  },
};

/**
 * Get game config by ID
 */
export function getGameConfig(gameId: GameId): GameConfig {
  return GAMES[gameId];
}

/** Short display labels for each game */
export const GAME_LABELS: Record<GameId, string> = {
  gi: "GI",
  hsr: "HSR",
  zzz: "ZZZ",
};
