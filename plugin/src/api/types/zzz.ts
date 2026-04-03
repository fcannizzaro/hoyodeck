// ============================================
// Daily Note types
// ============================================

export interface ZZZEnergyProgress {
  current: number;
  max: number;
}

export interface ZZZEnergy {
  progress: ZZZEnergyProgress;
  restore: number;
}

export interface ZZZDailyNote {
  energy: ZZZEnergy;
}

// ============================================
// Gacha Calendar (Banner) types
// ============================================

export interface ZZZGachaEventCharacter {
  avatar_id: number;
  avatar_name: string;
  full_name: string;
  rarity: string;
  icon: string;
}

export interface ZZZGachaEventWeapon {
  weapon_id: number;
  rarity: string;
  icon: string;
}

export interface ZZZCharacterGachaEvent {
  gacha_type: string;
  gacha_state: string;
  start_ts: number;
  end_ts: number;
  left_start_ts: number;
  left_end_ts: number;
  version: string;
  avatar_list: ZZZGachaEventCharacter[];
}

export interface ZZZWeaponGachaEvent {
  gacha_type: string;
  gacha_state: string;
  start_ts: number;
  end_ts: number;
  left_start_ts: number;
  left_end_ts: number;
  version: string;
  weapon_list: ZZZGachaEventWeapon[];
}

export interface ZZZGachaCalendar {
  avatar_gacha_schedule_list: ZZZCharacterGachaEvent[];
  weapon_gacha_schedule_list: ZZZWeaponGachaEvent[];
}

// ============================================
// Endgame types
// ============================================

/**
 * Date components used in ZZZ API responses
 */
export interface ZZZDateComponents {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * ZZZ Shiyu Defense (Hadal) response (v2 format)
 */
export interface ZZZShiyuDefense {
  zone_id: number;
  hadal_begin_time: ZZZDateComponents | null;
  hadal_end_time: ZZZDateComponents | null;
  pass_fifth_floor: boolean;
  brief: unknown | null;
  fitfh_layer_detail: unknown | null;
  fourth_layer_detail: unknown | null;
  begin_time: string;
  end_time: string;
}

/**
 * ZZZ Deadly Assault response
 */
export interface ZZZDeadlyAssault {
  start_time: ZZZDateComponents;
  end_time: ZZZDateComponents;
  rank_percent: number;
  list: unknown[];
  has_data: boolean;
  nick_name: string;
  avatar_icon: string;
  total_score: number;
  total_star: number;
  zone_id: number;
  total_max_score: number;
  room_max_score: number;
}
