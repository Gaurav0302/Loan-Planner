import { PageHeader } from '../components/PageHeader';

interface Props {
  title: string;
  sub: string;
  phase: number;
  coming: string;
}

/** Screens that later phases fill in. */
export function Placeholder({ title, sub, phase, coming }: Props) {
  return (
    <div className="page">
      <PageHeader title={title} sub={sub} />
      <p className="notice">
        Arrives in phase {phase}: {coming}
      </p>
    </div>
  );
}
