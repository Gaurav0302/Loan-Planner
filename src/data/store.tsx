import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { loadData, saveData, starterData } from './load';
import type { AppData, Plan } from './types';

export type Action =
  | { type: 'replaceAll'; data: AppData }
  | { type: 'reset' }
  | { type: 'dismissImportNotice' }
  | { type: 'setActive'; id: string }
  | { type: 'addPlan'; plan: Plan }
  | { type: 'savePlan'; plan: Plan }
  | { type: 'deletePlan'; id: string }
  | { type: 'setDraft'; plan: Plan }
  | { type: 'discardDraft'; id: string };

function withoutDraft(drafts: AppData['drafts'], id: string): AppData['drafts'] {
  if (!drafts || !(id in drafts)) return drafts;
  const rest = { ...drafts };
  delete rest[id];
  return Object.keys(rest).length ? rest : undefined;
}

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'replaceAll':
      return action.data;
    case 'reset':
      return starterData();
    case 'dismissImportNotice':
      return { ...state, importNoticeSeen: true };
    case 'setActive':
      return state.plans.some((p) => p.id === action.id) ? { ...state, activePlanId: action.id } : state;
    case 'addPlan':
      return { ...state, plans: [...state.plans, action.plan] };
    case 'savePlan': {
      const plan = { ...action.plan, editedAt: new Date().toISOString() };
      return { ...state, plans: state.plans.map((p) => (p.id === plan.id ? plan : p)), drafts: withoutDraft(state.drafts, plan.id) };
    }
    case 'deletePlan': {
      if (state.plans.length <= 1) return state;
      const plans = state.plans.filter((p) => p.id !== action.id);
      const activePlanId = state.activePlanId === action.id ? plans[0].id : state.activePlanId;
      return { ...state, plans, activePlanId, drafts: withoutDraft(state.drafts, action.id) };
    }
    case 'setDraft':
      return { ...state, drafts: { ...state.drafts, [action.plan.id]: action.plan } };
    case 'discardDraft':
      return { ...state, drafts: withoutDraft(state.drafts, action.id) };
  }
}

interface Store {
  data: AppData;
  activePlan: Plan;
  dispatch: (action: Action) => void;
  /** False when the browser refused to save (private window, storage full or blocked). */
  saved: boolean;
}

const StoreContext = createContext<Store | null>(null);

export function DataProvider({ children, initial }: { children: ReactNode; initial?: AppData }) {
  const [data, dispatch] = useReducer(reducer, undefined, () => initial ?? loadData());
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    // The first load is saved too, so data brought over from the previous site is kept from then on.
    setSaved(saveData(data));
  }, [data]);

  const value = useMemo<Store>(() => {
    const activePlan = data.plans.find((p) => p.id === data.activePlanId) ?? data.plans[0];
    return { data, activePlan, dispatch, saved };
  }, [data, saved]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <DataProvider>');
  return store;
}
