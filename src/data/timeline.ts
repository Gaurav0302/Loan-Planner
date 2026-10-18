import { moneyShort, toIdx, type Change, type Kid, type Lump } from '../engine';
import { describeChange } from './describe';

export interface LaneItem {
  id: string;
  start: number;
  /** Last month of a temporary change; undefined for a one-off or "from then on". */
  end?: number;
  label: string;
  /** Full sentence for screen readers and the tooltip. */
  description: string;
  recorded: boolean;
}

/** A few words for a chip on the timeline: "Rate 5.95%", "Partner $0", "+$20k". */
export function shortLabel(c: Change, kids: Kid[]): string {
  switch (c.type) {
    case 'rate': return `Rate ${c.value.toFixed(2)}%`;
    case 'inc1': return `Your pay ${moneyShort(c.value)}`;
    case 'inc2': return `Partner ${moneyShort(c.value)}`;
    case 'living': return `Costs ${moneyShort(c.value)}`;
    case 'extra': return `Extra ${moneyShort(c.value)}`;
    case 'sweep': return c.value ? 'Sweep on' : 'Sweep off';
    case 'bonus': return `Bonus ${moneyShort(c.value)}`;
    default: return `${kids[Number(c.type.slice(3))]?.name ?? 'Child'} ${moneyShort(c.value)}`;
  }
}

export function laneItems(facts: Change[], factLumps: Lump[], changes: Change[], lumps: Lump[], kids: Kid[]): LaneItem[] {
  const fromChange = (c: Change, recorded: boolean): LaneItem => ({
    id: c.id, start: toIdx(c.month), end: c.until ? toIdx(c.until) : undefined, label: shortLabel(c, kids),
    description: `${recorded ? 'Recorded' : 'Guess'}: ${describeChange(c, kids)}`, recorded,
  });
  const fromLump = (l: Lump, recorded: boolean): LaneItem => ({
    id: l.id, start: toIdx(l.month), label: `+${moneyShort(l.amount)}`,
    description: `${recorded ? 'Recorded' : 'Guess'}: ${moneyShort(l.amount)} lump sum into the offset.`, recorded,
  });
  return [
    ...facts.map((c) => fromChange(c, true)), ...factLumps.map((l) => fromLump(l, true)),
    ...changes.map((c) => fromChange(c, false)), ...lumps.map((l) => fromLump(l, false)),
  ].sort((a, b) => a.start - b.start);
}

export interface PlacedItem extends LaneItem {
  row: number;
  /** Left edge and width in pixels. */
  x: number;
  w: number;
}

/**
 * Puts chips into rows so none overlap: each goes in the first row with room, up to `maxRows`;
 * past that it joins the row that frees up soonest. `toX` maps a month to pixels.
 */
export function layoutLane(items: LaneItem[], toX: (idx: number) => number, maxRows = 3, charWidth = 6.6, pad = 18): PlacedItem[] {
  const rowEnds: number[] = [];
  return items.map((it) => {
    const x = toX(it.start);
    const labelW = it.label.length * charWidth + pad;
    const spanW = it.end !== undefined ? toX(it.end + 1) - x : 0;
    const w = Math.max(labelW, spanW);
    let row = rowEnds.findIndex((end) => end <= x - 4);
    if (row === -1) row = rowEnds.length < maxRows ? rowEnds.length : rowEnds.indexOf(Math.min(...rowEnds));
    rowEnds[row] = x + w;
    return { ...it, row, x, w };
  });
}
