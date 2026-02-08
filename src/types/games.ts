/**
 * Game identifiers
 */
export type GameId = 'genshin' | 'starrail' | 'zzz';

/**
 * Game configuration
 */
export interface GameConfig {
  id: GameId;
  name: string;
  staminaMax: number;
  staminaField: string;
  staminaName: string;
  dailyNoteEndpoint: string;
  checkInActId: string;
  regions: Record<string, string>;
}

/**
 * Game registry - extensible for future games
 */
export const GAMES: Record<GameId, GameConfig> = {
  genshin: {
    id: 'genshin',
    name: 'Genshin Impact',
    staminaMax: 200,
    staminaField: 'current_resin',
    staminaName: 'Resin',
    dailyNoteEndpoint: '/game_record/genshin/api/dailyNote',
    checkInActId: 'e202102251931481',
    regions: {
      '1': 'cn_gf01',
      '2': 'cn_gf01',
      '5': 'cn_qd01',
      '6': 'os_usa',
      '7': 'os_euro',
      '8': 'os_asia',
      '9': 'os_cht',
    },
  },
  starrail: {
    id: 'starrail',
    name: 'Honkai: Star Rail',
    staminaMax: 240,
    staminaField: 'current_stamina',
    staminaName: 'Trailblaze Power',
    dailyNoteEndpoint: '/game_record/hkrpg/api/note',
    checkInActId: 'e202303301540311',
    regions: {
      '1': 'prod_gf_cn',
      '2': 'prod_gf_cn',
      '5': 'prod_qd_cn',
      '6': 'prod_official_usa',
      '7': 'prod_official_eur',
      '8': 'prod_official_asia',
      '9': 'prod_official_cht',
    },
  },
  zzz: {
    id: 'zzz',
    name: 'Zenless Zone Zero',
    staminaMax: 240,
    staminaField: 'energy',
    staminaName: 'Battery',
    dailyNoteEndpoint: '/event/game_record_zzz/api/zzz/note',
    checkInActId: 'e202406031448091',
    regions: {
      '10': 'prod_gf_us',
      '13': 'prod_gf_eu',
      '15': 'prod_gf_jp',
      '17': 'prod_gf_sg',
    },
  },
};

/**
 * Get game config by ID
 */
export function getGameConfig(gameId: GameId): GameConfig {
  return GAMES[gameId];
}
