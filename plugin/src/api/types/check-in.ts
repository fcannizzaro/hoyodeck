/**
 * Shared daily check-in types (same API shape across all games)
 */

/**
 * Check-in status info
 */
export interface CheckInInfo {
  total_sign_day: number;
  today: string;
  is_sign: boolean;
  is_sub: boolean;
  first_bind: boolean;
  region: string;
}

/**
 * Monthly check-in rewards list
 */
export interface CheckInRewards {
  month: number;
  awards: CheckInReward[];
}

/**
 * Single reward item
 */
export interface CheckInReward {
  icon: string;
  name: string;
  cnt: number;
}

/**
 * Check-in claim response
 */
export interface CheckInClaim {
  code: string;
  risk_code: number;
  gt: string;
  challenge: string;
  success: number;
}
