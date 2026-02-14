/**
 * Honkai: Star Rail Daily Note response
 */
export interface StarRailDailyNote {
  current_stamina: number;
  max_stamina: number;
  stamina_recover_time: number;
  stamina_full_ts: number;
  current_reserve_stamina: number;
  is_reserve_stamina_full: boolean;
  accepted_epedition_num: number;
  total_expedition_num: number;
  expeditions: StarRailExpedition[];
  current_train_score: number;
  max_train_score: number;
  current_rogue_score: number;
  max_rogue_score: number;
  weekly_cocoon_cnt: number;
  weekly_cocoon_limit: number;
  rogue_tourn_weekly_unlocked: boolean;
  rogue_tourn_weekly_max: number;
  rogue_tourn_weekly_cur: number;
  current_ts: number;
  rogue_tourn_exp_is_full: boolean;
  grid_fight_weekly_cur: number;
  grid_fight_weekly_max: number;
}

/**
 * Star Rail expedition entry
 */
export interface StarRailExpedition {
  avatars: string[];
  status: string;
  remaining_time: number;
  name: string;
}

// ============================================
// Act Calendar (Banner) types
// ============================================

/**
 * Time info for Star Rail calendar entries
 */
export interface StarRailCalendarTimeInfo {
  start_ts: string;
  end_ts: string;
  start_time: string;
  end_time: string;
  now: string;
}

/**
 * Avatar entry in a Star Rail banner pool
 */
export interface StarRailCalendarAvatar {
  item_id: string;
  item_name: string;
  icon_url: string;
  damage_type: string;
  rarity: string;
  avatar_base_type: string;
  is_forward: boolean;
  wiki_url: string;
  item_avatar_icon_path: string;
  damage_type_name: string;
}

/**
 * Equipment (Light Cone) entry in a Star Rail banner pool
 */
export interface StarRailCalendarEquip {
  item_id: string;
  item_name: string;
  item_url: string;
  avatar_base_type: string;
  rarity: string;
  is_forward: boolean;
  wiki_url: string;
}

/**
 * A single Star Rail banner pool (character or equipment)
 */
export interface StarRailBannerPool {
  name: string;
  type: string;
  avatar_list: StarRailCalendarAvatar[];
  equip_list: StarRailCalendarEquip[];
  is_after_version: boolean;
  time_info: StarRailCalendarTimeInfo;
  version: string;
  id: string;
  gacha_time_type: string;
}

/**
 * Star Rail Act Calendar response
 */
export interface StarRailActCalendar {
  avatar_card_pool_list: StarRailBannerPool[];
  equip_card_pool_list: StarRailBannerPool[];
  act_list: unknown[];
  challenge_list: unknown[];
  now: string;
  cur_game_version: string;
}
