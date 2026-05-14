'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'tp_theme';

function readInitial(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function DarkModeToggle() {
  // SSR-safe: render the toggle button after hydration to avoid mismatch when
  // the OS preference differs from the rendered initial state. The .dark class
  // is applied to <html> by lib/theme-init.ts in a blocking script tag.
  const [mode, setMode] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    setMode(readInitial());
  }, []);

  function toggle() {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle('dark', next === 'dark');
  }

  if (mode === null) {
    // Reserve space so the topbar doesn't reflow on hydration
    return <button className="dark-toggle" aria-label="Theme" suppressHydrationWarning />;
  }

  return (
    <button
      type="button"
      className="dark-toggle"
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
      title={mode === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {mode === 'dark' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
