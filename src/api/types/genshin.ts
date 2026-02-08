/**
 * Genshin Impact Daily Note response
 */
export interface GenshinDailyNote {
  current_resin: number;
  max_resin: number;
  resin_recovery_time: string;
  finished_task_num: number;
  total_task_num: number;
  is_extra_task_reward_received: boolean;
  remain_resin_discount_num: number;
  resin_discount_num_limit: number;
  current_expedition_num: number;
  max_expedition_num: number;
  expeditions: GenshinExpedition[];
  current_home_coin: number;
  max_home_coin: number;
  home_coin_recovery_time: string;
  transformer: GenshinTransformer;
}

/**
 * Expedition info
 */
export interface GenshinExpedition {
  avatar_side_icon: string;
  status: 'Ongoing' | 'Finished';
  remained_time: string;
}

/**
 * Parametric Transformer info
 */
export interface GenshinTransformer {
  obtained: boolean;
  recovery_time: {
    Day: number;
    Hour: number;
    Minute: number;
    Second: number;
    reached: boolean;
  };
}

/**
 * Spiral Abyss response
 */
export interface GenshinSpiralAbyss {
  schedule_id: number;
  start_time: string;
  end_time: string;
  total_battle_times: number;
  total_win_times: number;
  max_floor: string;
  total_star: number;
  is_unlock: boolean;
  floors: GenshinAbyssFloor[];
}

/**
 * Abyss floor info
 */
export interface GenshinAbyssFloor {
  index: number;
  icon: string;
  is_unlock: boolean;
  settle_time: string;
  star: number;
  max_star: number;
  levels: GenshinAbyssLevel[];
}

/**
 * Abyss level info
 */
export interface GenshinAbyssLevel {
  index: number;
  star: number;
  max_star: number;
  battles: unknown[];
}

/**
 * Daily check-in info response
 */
export interface GenshinCheckInInfo {
  total_sign_day: number;
  today: string;
  is_sign: boolean;
  is_sub: boolean;
  first_bind: boolean;
  region: string;
}

/**
 * Daily check-in rewards response
 */
export interface GenshinCheckInRewards {
  month: number;
  awards: GenshinReward[];
}

/**
 * Reward item
 */
export interface GenshinReward {
  icon: string;
  name: string;
  cnt: number;
}

/**
 * Check-in claim response
 */
export interface GenshinCheckInClaim {
  code: string;
  risk_code: number;
  gt: string;
  challenge: string;
  success: number;
}

// ============================================
// Act Calendar (Banner) types
// ============================================

/**
 * Avatar entry in a banner pool
 */
export interface GenshinCalendarAvatar {
  id: number;
  icon: string;
  name: string;
  element: string;
  rarity: number;
  is_invisible: boolean;
}

/**
 * Weapon entry in a banner pool
 */
export interface GenshinCalendarWeapon {
  id: number;
  icon: string;
  rarity: number;
  name: string;
  wiki_url: string;
}

/**
 * A single banner pool (character or weapon)
 */
export interface GenshinBannerPool {
  pool_id: number;
  version_name: string;
  pool_name: string;
  pool_type: number;
  avatars: GenshinCalendarAvatar[];
  weapon: GenshinCalendarWeapon[];
  start_timestamp: string;
  end_timestamp: string;
  countdown_seconds: number;
  pool_status: number;
}

/**
 * Act Calendar response containing all active banner pools
 */
export interface GenshinActCalendar {
  avatar_card_pool_list: GenshinBannerPool[];
  weapon_card_pool_list: GenshinBannerPool[];
  selected_avatar_card_pool_list: GenshinBannerPool[];
}
