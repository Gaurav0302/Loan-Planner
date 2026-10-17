import { toIdx } from '../engine';
import { readItem } from './storage';

/**
 * This calendar month as a month index. While developing, a "YYYY-MM" value under
 * localStorage "timbertop:today" pretends it is that month, so check-ins can be tried before the loan starts.
 */
export function currentMonthIdx(now: Date = new Date()): number {
  if (import.meta.env.DEV) {
    const override = readItem('timbertop:today');
    if (override && /^\d{4}-(0[1-9]|1[0-2])$/.test(override)) return toIdx(override);
  }
  return now.getFullYear() * 12 + now.getMonth();
}
