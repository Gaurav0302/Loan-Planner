import { money, monthLabel, percent, toIdx, type Change, type ChangeType, type Kid, type Setup } from '../engine';

/** Names for each kind of change, in the order the "add a change" menu shows them. */
export function changeKinds(kids: Kid[]): { type: ChangeType; label: string }[] {
  return [
    { type: 'rate', label: 'Interest rate' },
    { type: 'extra', label: 'Extra into the offset' },
    { type: 'sweep', label: 'Put all spare money in' },
    { type: 'inc1', label: 'Your take-home' },
    { type: 'inc2', label: 'Partner’s take-home' },
    { type: 'living', label: 'Living costs' },
    { type: 'bonus', label: 'Yearly bonus' },
    ...kids.map((k, i) => ({ type: `kid${i}` as ChangeType, label: `${k.name}’s college saving` })),
  ];
}

export function formatChangeValue(type: ChangeType, value: number): string {
  if (type === 'rate') return percent(value);
  if (type === 'sweep') return value ? 'on' : 'off';
  return money(value);
}

/** "From Jul 2028 to Jun 2029, partner's take-home becomes $0 a month, then goes back." */
export function describeChange(c: Change, kids: Kid[]): string {
  const when = c.until ? `From ${monthLabel(toIdx(c.month))} to ${monthLabel(toIdx(c.until))}` : `From ${monthLabel(toIdx(c.month))}`;
  const v = formatChangeValue(c.type, c.value);
  let what: string;
  switch (c.type) {
    case 'rate':
      what = `the rate becomes ${v}`;
      if (c.keepPaying) what += `, and you keep paying ${money(c.keepPaying)}`;
      else if (c.repayment) what += `, and the bank sets the repayment to ${money(c.repayment)}`;
      break;
    case 'extra': what = `extra into the offset becomes ${v} a month`; break;
    case 'sweep': what = c.value ? 'all spare money goes into the offset' : 'spare money stops going into the offset automatically'; break;
    case 'inc1': what = `your take-home becomes ${v} a month`; break;
    case 'inc2': what = `partner’s take-home becomes ${v} a month`; break;
    case 'living': what = `living costs become ${v} a month`; break;
    case 'bonus': what = `the yearly bonus becomes ${v}`; break;
    default: {
      const kid = kids[Number(c.type.slice(3))];
      what = `${kid ? kid.name : 'a child'}’s college saving becomes ${v} a month`;
    }
  }
  return `${when}, ${what}${c.until ? ', then goes back' : ''}.`;
}

/** The setting's value before any changes, for prefilling a new change. */
export function startingValue(setup: Setup, type: ChangeType): number {
  switch (type) {
    case 'rate': return setup.rate;
    case 'extra': return setup.extra;
    case 'sweep': return setup.sweep ? 0 : 1;
    case 'inc1': return setup.inc1;
    case 'inc2': return setup.inc2;
    case 'living': return setup.living;
    case 'bonus': return setup.bonus || 5000;
    default: return setup.kids[Number(type.slice(3))]?.monthly ?? 0;
  }
}

/** Monthly amount that reaches a child's goal by the time university starts, at the fund's growth rate. */
export function monthlyForGoal(setup: Setup, kid: Kid): number {
  const months = Math.max(1, kid.uni * 12 + 1 - toIdx(kid.start));
  const i = (setup.kidsInOffset ? setup.rate : setup.eduRate) / 100 / 12;
  // Each month's saving also earns that month's growth, as in the engine.
  return i === 0 ? kid.goal / months : (kid.goal * i) / ((Math.pow(1 + i, months) - 1) * (1 + i));
}
