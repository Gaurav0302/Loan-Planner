/** "Edited just now", "Edited 3 days ago", "Edited 12 Mar 2027". */
export function editedAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const minutes = Math.round((now.getTime() - then.getTime()) / 60000);
  if (minutes < 2) return 'Edited just now';
  if (minutes < 60) return `Edited ${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Edited ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `Edited ${days} ${days === 1 ? 'day' : 'days'} ago`;
  return `Edited ${then.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
