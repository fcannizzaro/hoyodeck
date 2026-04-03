/**
 * Format countdown from remaining seconds.
 * @param seconds Remaining seconds until banner ends
 * @returns Formatted string like "5d 3h" or "Ended"
 */
export const formatCountdownFromSeconds = (seconds: number): string => {
  if (seconds <= 0) return "Ended";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);

  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
};
