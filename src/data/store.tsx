import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { loadData, saveData, starterData } from './load';
import type { AppData, Plan } from './types';

export type Action =
  | { type: 'replaceAll'; data: AppData }
  | { type: 'reset' }
  | { type: 'dismissImportNotice' };

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'replaceAll':
      return action.data;
    case 'reset':
      return starterData();
    case 'dismissImportNotice':
      return { ...state, importNoticeSeen: true };
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
