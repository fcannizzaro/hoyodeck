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

// ============================================
// Challenge (Endgame) types
// ============================================

/**
 * Date component object used by HoYoLAB API responses
 */
export interface StarRailDateComponents {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * Boss entry in an Apocalyptic Shadow challenge group
 */
export interface StarRailChallengeBoss {
  id: number;
  name_mi18n: string;
  icon: string;
}

/**
 * A challenge schedule group (current/previous season metadata)
 */
export interface StarRailChallengeGroup {
  schedule_id: number;
  begin_time: StarRailDateComponents;
  end_time: StarRailDateComponents;
  status: string;
  name_mi18n: string;
  upper_boss: StarRailChallengeBoss | null;
  lower_boss: StarRailChallengeBoss | null;
}

/**
 * Avatar used in a challenge node
 */
export interface StarRailChallengeAvatar {
  id: number;
  level: number;
  icon: string;
  rarity: number;
  element: string;
  rank: number;
}

/**
 * Buff applied to a challenge node (Pure Fiction / Apocalyptic Shadow)
 */
export interface StarRailChallengeBuff {
  id: number;
  name_mi18n: string;
  desc_mi18n: string;
  icon: string;
  simple_desc_mi18m?: string;
}

/**
 * A single node within a challenge floor (upper or lower half)
 */
export interface StarRailChallengeNode {
  challenge_time: StarRailDateComponents | null;
  avatars: StarRailChallengeAvatar[];
  buff?: StarRailChallengeBuff | null;
  score?: string;
  boss_defeated?: boolean;
}

/**
 * A floor detail entry in a challenge
 */
export interface StarRailFloorDetail {
  name: string;
  round_num?: number;
  star_num: number | string;
  node_1: StarRailChallengeNode;
  node_2: StarRailChallengeNode;
  maze_id: number;
  is_fast: boolean;
  is_chaos?: boolean;
  last_update_time?: StarRailDateComponents;
}

/**
 * Star Rail Challenge response
 * Shared by Memory of Chaos, Pure Fiction, and Apocalyptic Shadow.
 * Some root-level fields are only present for MoC.
 */
export interface StarRailChallenge {
  schedule_id?: number;
  begin_time?: StarRailDateComponents;
  end_time?: StarRailDateComponents;
  star_num: number;
  max_floor: string;
  battle_num: number;
  has_data?: boolean;
  max_floor_detail?: unknown | null;
  max_floor_id: number;
  all_floor_detail: StarRailFloorDetail[];
  groups: StarRailChallengeGroup[];
}

// ============================================
// Anomaly Arbitration (Challenge Peak) types
// ============================================

/**
 * Group metadata for an Anomaly Arbitration season
 */
export interface StarRailChallengePeakGroup {
  group_id: number;
  begin_time: StarRailDateComponents;
  end_time: StarRailDateComponents;
  status: string;
  name_mi18n: string;
  game_version: string;
  theme_pic_path: string;
}

/**
 * Mob (Knight) record in an Anomaly Arbitration season
 */
export interface StarRailChallengePeakMobRecord {
  maze_id: number;
  has_challenge_record: boolean;
  challenge_time: StarRailDateComponents | null;
  avatars: StarRailChallengeAvatar[];
  round_num: number;
  star_num: number;
  is_fast: boolean;
}

/**
 * A single Anomaly Arbitration season record
 */
export interface StarRailChallengePeakRecord {
  group: StarRailChallengePeakGroup;
  boss_info: unknown;
  mob_infos: unknown[];
  has_challenge_record: boolean;
  battle_num: number;
  boss_record: unknown | null;
  mob_records: StarRailChallengePeakMobRecord[];
  boss_stars: number;
  mob_stars: number;
}

/**
 * Best record brief for Anomaly Arbitration
 */
export interface StarRailChallengePeakBrief {
  total_battle_num: number;
  mob_stars: number;
  boss_stars: number;
  challenge_peak_rank_icon_type: string;
  challenge_peak_rank_icon: string;
}

/**
 * Anomaly Arbitration (challenge_peak) response.
 * Different structure from StarRailChallenge — uses mob_stars + boss_stars.
 */
export interface StarRailChallengePeak {
  challenge_peak_records: StarRailChallengePeakRecord[];
  has_more_boss_record: boolean;
  challenge_peak_best_record_brief: StarRailChallengePeakBrief;
  role: unknown;
}
