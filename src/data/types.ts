import type { Change, Lump, Setup, YM } from '../engine';

export const DATA_VERSION = 3;

/** A named set of starting values and guesses about the future. One plan is active at a time. */
export interface Plan {
  id: string;
  name: string;
  /** Dot colour used to tell plans apart. */
  color: string;
  setup: Setup;
  /** This plan's own guesses: changes it expects from a month onwards. */
  changes: Change[];
  /** One-off lump sums this plan expects. */
  lumps: Lump[];
  /** ISO timestamp. */
  editedAt: string;
}

/** Statement balances at the end of a month. `kids` lines up with the active plan's children. */
export interface CheckIn {
  month: YM;
  loan: number;
  offset: number;
  kids: number[];
}

export interface AppData {
  version: typeof DATA_VERSION;
  plans: Plan[];
  activePlanId: string;
  /** Things that really happened. They apply to every plan. */
  facts: Change[];
  factLumps: Lump[];
  checkIns: CheckIn[];
  /** Set when data was brought over from the previous version of the site (ISO timestamp). */
  importedFromClassic?: string;
  /** The "we brought your data over" note has been dismissed. */
  importNoticeSeen?: boolean;
}

export const PLAN_COLORS = ['#3B7BEA', '#8B5CF6', '#E2622D', '#14A37F', '#DB2777', '#0891B2'];
