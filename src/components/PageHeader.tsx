import type { ReactNode } from 'react';

interface Props {
  eyebrow?: string;
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, sub, actions }: Props) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="page-title" tabIndex={-1}>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions}
    </header>
  );
}
