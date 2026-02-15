/**
 * Format seconds as "Xh Ym" or "Xm"
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Ready';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format days remaining from a date
 */
export function formatDaysRemaining(endDate: Date): string {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days <= 0) return 'Ended';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/**
 * Format transformer recovery time
 */
export function formatTransformerTime(recovery: {
  Day: number;
  Hour: number;
  Minute: number;
  Second: number;
  reached: boolean;
}): string {
  if (recovery.reached) {
    return 'Ready';
  }

  if (recovery.Day > 0) {
    return `${recovery.Day}d ${recovery.Hour}h`;
  }

  if (recovery.Hour > 0) {
    return `${recovery.Hour}h ${recovery.Minute}m`;
  }

  return `${recovery.Minute}m`;
}

/**
 * Parse a string time (seconds) to number
 */
export function parseRecoveryTime(time: string): number {
  return parseInt(time, 10) || 0;
}
