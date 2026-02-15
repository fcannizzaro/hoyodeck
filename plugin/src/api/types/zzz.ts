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
