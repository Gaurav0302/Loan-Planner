import { useCallback, useEffect, useState } from 'react';
import { readItem, writeItem } from './storage';

export type Theme = 'light' | 'dark';

const KEY = 'timbertop:theme';

function initialTheme(): Theme {
  const saved = readItem(KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'dark';
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    writeItem(KEY, t);
  }, []);

  return [theme, setTheme];
}
