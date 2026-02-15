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
