/**
 * Format days remaining from a date
 */
export function formatDaysRemaining(endDate: Date): string {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days <= 0) return "Ended";
  if (days === 1) return "1 day";
  return `${days} days`;
}
