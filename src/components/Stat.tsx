import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'good' | 'plain';
}

export function Stat({ label, value, sub, tone = 'plain' }: Props) {
  return (
    <div className={tone === 'good' ? 'stat good' : 'stat'}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}
