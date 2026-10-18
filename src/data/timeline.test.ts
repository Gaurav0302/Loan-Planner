import { describe, expect, it } from 'vitest';
import { toIdx } from '../engine';
import { laneItems, layoutLane, shortLabel } from './timeline';

const kids = [{ name: 'Greesha', monthly: 300, start: '2026-12', uni: 2034, goal: 0 }];

describe('timeline lane', () => {
  it('labels changes in a few words', () => {
    expect(shortLabel({ id: 'a', month: '2027-03', type: 'rate', value: 5.95 }, kids)).toBe('Rate 5.95%');
    expect(shortLabel({ id: 'b', month: '2028-07', type: 'inc2', value: 0 }, kids)).toBe('Partner $0');
    expect(shortLabel({ id: 'c', month: '2028-01', type: 'kid0', value: 400 }, kids)).toBe('Greesha $400');
    expect(shortLabel({ id: 'd', month: '2028-01', type: 'sweep', value: 1 }, kids)).toBe('Sweep on');
  });

  it('lists recorded facts and guesses in date order, with ranges', () => {
    const items = laneItems(
      [{ id: 'f', month: '2027-03', type: 'rate', value: 5.95 }], [],
      [{ id: 'g', month: '2028-07', until: '2029-06', type: 'inc2', value: 0 }], [{ id: 'l', month: '2027-09', amount: 20000 }],
      kids,
    );
    expect(items.map((i) => `${i.label}|${i.recorded}`)).toEqual(['Rate 5.95%|true', '+$20k|false', 'Partner $0|false']);
    expect(items[2].end).toBe(toIdx('2029-06'));
    expect(items[0].description).toBe('Recorded: From Mar 2027, the rate becomes 5.95%.');
  });

  it('stacks chips that would overlap and keeps the rest on the first row', () => {
    const toX = (idx: number) => (idx - toIdx('2027-01')) * 10;
    const items = laneItems([], [], [
      { id: 'a', month: '2027-01', type: 'rate', value: 6 },
      { id: 'b', month: '2027-02', type: 'rate', value: 6.1 },
      { id: 'c', month: '2027-03', type: 'rate', value: 6.2 },
      { id: 'd', month: '2027-04', type: 'rate', value: 6.3 },
      { id: 'e', month: '2030-01', type: 'rate', value: 6.4 },
    ], [], kids);
    const placed = layoutLane(items, toX, 3);
    expect(placed.map((p) => p.row)).toEqual([0, 1, 2, 0, 0]);
  });
});
