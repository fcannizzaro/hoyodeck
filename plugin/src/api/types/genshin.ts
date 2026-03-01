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
  calendar_url: string;
  transformer: GenshinTransformer;
  daily_task: GenshinDailyTask;
  archon_quest_progress: GenshinArchonQuestProgress;
}

/**
 * Expedition info
 */
export interface GenshinExpedition {
  avatar_side_icon: string;
  status: "Ongoing" | "Finished";
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
  wiki: string;
  noticed: boolean;
  latest_job_id: string;
}

/**
 * Task reward status
 */
export interface GenshinTaskReward {
  status: string;
}

/**
 * Attendance reward status
 */
export interface GenshinAttendanceReward {
  status: string;
  progress: number;
}

/**
 * Daily task info (commissions)
 */
export interface GenshinDailyTask {
  total_num: number;
  finished_num: number;
  is_extra_task_reward_received: boolean;
  task_rewards: GenshinTaskReward[];
  attendance_rewards: GenshinAttendanceReward[];
  attendance_visible: boolean;
  stored_attendance: string;
  stored_attendance_refresh_countdown: number;
}

/**
 * Archon quest entry
 */
export interface GenshinArchonQuest {
  status: string;
  chapter_num: string;
  chapter_title: string;
  id: number;
  chapter_type: number;
}

/**
 * Archon quest progress
 */
export interface GenshinArchonQuestProgress {
  list: GenshinArchonQuest[];
  is_open_archon_quest: boolean;
  is_finish_all_mainline: boolean;
  is_finish_all_interchapter: boolean;
  wiki_url: string;
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

// ============================================
// Stygian Onslaught (Hard Challenge) types
// ============================================

/**
 * Schedule info for a Stygian Onslaught season.
 * Uses Unix timestamp strings (seconds since epoch).
 */
export interface GenshinHardChallengeSchedule {
  schedule_id: string;
  start_time: string;
  end_time: string;
  start_date_time: GenshinTheaterDateTime;
  end_date_time: GenshinTheaterDateTime;
  is_valid: boolean;
  name: string;
}

/**
 * Best result for a Stygian Onslaught season (single or mp).
 * Difficulty: 1=Menacing, 2=Dire, 3=Fearless.
 */
export interface GenshinHardChallengeBest {
  difficulty: number;
  second: number;
  icon: string;
}

/**
 * Single-player or multiplayer challenge data
 */
export interface GenshinHardChallengeMode {
  best: GenshinHardChallengeBest | null;
  challenge: unknown[];
  has_data: boolean;
}

/**
 * A single Stygian Onslaught season entry.
 */
export interface GenshinHardChallengeEntry {
  schedule: GenshinHardChallengeSchedule;
  single: GenshinHardChallengeMode;
  mp: GenshinHardChallengeMode;
  blings: unknown[];
}

/**
 * Stygian Onslaught (hard_challenge) response — wraps a list of season entries.
 */
export interface GenshinStygianOnslaught {
  data: GenshinHardChallengeEntry[] | null;
  is_unlock: boolean;
  links: { lineup_link: string; play_link: string };
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

// ============================================
// Imaginarium Theater (Role Combat) types
// ============================================

/**
 * Imaginarium Theater stat summary
 */
export interface GenshinTheaterStat {
  difficulty_id: number;
  max_round_id: number;
  heraldry: number;
  get_medal_round_list: number[];
  medal_num: number;
  coin_num: number;
  avatar_bonus_num: number;
  rent_cnt: number;
  tarot_finished_cnt: number;
}

/**
 * Date-time components used in Imaginarium Theater schedule
 */
export interface GenshinTheaterDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Schedule info for an Imaginarium Theater season
 */
export interface GenshinTheaterScheduleInfo {
  start_time: string;
  end_time: string;
  schedule_type: number;
  schedule_id: number;
  start_date_time: GenshinTheaterDateTime;
  end_date_time: GenshinTheaterDateTime;
}

/**
 * A single Imaginarium Theater season entry
 */
export interface GenshinTheaterEntry {
  detail: unknown | null;
  stat: GenshinTheaterStat;
  schedule: GenshinTheaterScheduleInfo;
  has_data: boolean;
  has_detail_data: boolean;
}

/**
 * Imaginarium Theater response — contains a list of seasons
 */
export interface GenshinImaginariumTheater {
  data: GenshinTheaterEntry[] | null;
  is_unlock: boolean;
}
