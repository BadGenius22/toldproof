'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { DarkModeToggle } from './DarkModeToggle';

export interface MobileNavItem {
  href: string;
  label: string;
  active?: boolean;
}

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  nav: MobileNavItem[];
}

export function MobileNavDrawer({ open, onClose, nav }: MobileNavDrawerProps) {
  // Lock background scroll while the drawer is open so the page underneath
  // doesn't move when the user scrolls inside the drawer.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape closes the drawer — standard a11y for any dialog-ish surface.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div
      className={`mobile-drawer${open ? ' open' : ''}`}
      aria-hidden={!open}
      role="dialog"
      aria-label="Navigation"
    >
      <button
        type="button"
        className="mobile-drawer-backdrop"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <aside className="mobile-drawer-panel">
        <div className="mobile-drawer-head">
          <span className="mono eyebrow">Menu</span>
          <button
            type="button"
            className="mobile-drawer-close"
            aria-label="Close menu"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <nav className="mobile-drawer-nav">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.active ? 'active' : ''}
              onClick={onClose}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mobile-drawer-foot">
          <span className="testnet-dot">
            <span className="dot" />
            testnet
          </span>
          <DarkModeToggle />
        </div>
      </aside>
    </div>
  );
}
