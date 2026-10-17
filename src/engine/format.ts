/** "$1,104,000" (rounded to the dollar). */
export function money(n: number): string {
  return (n < 0 ? '−$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-AU');
}

/** "$529k", "$1.33m", "$9.5k", "$640". */
export function moneyShort(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}m`;
  if (a >= 10000) return `${sign}$${Math.round(a / 1000)}k`;
  if (a >= 1000) return `${sign}$${(a / 1000).toFixed(1)}k`;
  return money(n);
}

/** "6.20%" */
export function percent(n: number): string {
  return `${n.toFixed(2)}%`;
}

/** "14 months" / "2.5 years" for a count of months. */
export function duration(months: number): string {
  const a = Math.abs(months);
  if (a >= 24) return `${(a / 12).toFixed(1)} years`;
  return `${a} ${a === 1 ? 'month' : 'months'}`;
}

/** "14.3 yrs" */
export function years(months: number): string {
  return `${(months / 12).toFixed(1)} yrs`;
}
