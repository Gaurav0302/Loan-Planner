import type { Setup } from './types';

/** Starting values, taken from the original planner's built-in defaults. */
export const DEFAULT_SETUP: Setup = {
  loan: 1104000,
  rate: 6.2,
  term: 30,
  start: '2026-12',
  offset0: 71000,
  inc1: 9500,
  inc2: 8000,
  living: 6000,
  sac1: 350,
  sac2: 350,
  tax: 35,
  growth: 0,
  extra: 2000,
  sweep: false,
  bonus: 0,
  bonusMonth: 7,
  kids: [
    { name: 'Greesha', monthly: 300, start: '2026-12', uni: 2034, goal: 0 },
    { name: 'Son', monthly: 300, start: '2026-12', uni: 2038, goal: 0 },
  ],
  kidsInOffset: true,
  eduRate: 4,
  uniYears: 3,
};
