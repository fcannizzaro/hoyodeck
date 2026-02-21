import type { GameId } from '@/types/games';

/** Maps HoYoLAB numeric game IDs to our internal GameId */
export const HOYOLAB_GAME_IDS: Record<number, GameId> = {
  2: 'gi',
  6: 'hsr',
  8: 'zzz',
};

/** A single game entry from the game record card API */
export interface GameRecordCard {
  has_role: boolean;
  game_id: number;
  /** The in-game UID */
  game_role_id: string;
  nickname: string;
  region: string;
  level: number;
}

/** Response from getGameRecordCard */
export interface GameRecordCardResponse {
  list: GameRecordCard[];
}
