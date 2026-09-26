import { useCallback, useEffect, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'possir.theme';

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'system' || v === 'dark' ? v : 'light';
  } catch {
    return 'light';
  }
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const canvas = getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', canvas));
}

export function useTheme(): [ThemePref, (pref: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(readPref);

  useEffect(() => {
    apply(pref);
    if (pref !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [pref]);

  const update = useCallback((next: ThemePref) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // abaikan
    }
    setPref(next);
  }, []);

  return [pref, update];
}
