'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PixelMark } from './PixelMark';
import { BRAND_MARK, SUI_MARK } from './bitmaps';
import { DarkModeToggle } from './DarkModeToggle';
import { MobileNavDrawer } from './MobileNavDrawer';
import { WalletConnect } from '../WalletConnect';
import { XSignInButton } from '../XSignInButton';
import { useXSession } from '../../lib/useXSession';
import { shortHash } from './format';

// Default to the audited testnet deployment so the badge still works on
// previews where NEXT_PUBLIC_* may not be inlined yet.
const FALLBACK_PACKAGE_ID =
  '0x97b738cecf808f17a80fabd55726df2ab31c97ec314c04e4810d5a504c3bd221';
const PACKAGE_ID =
  process.env.NEXT_PUBLIC_TOLDPROOF_PACKAGE_ID || FALLBACK_PACKAGE_ID;
const NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet';

// Canonical demo profile shown in the nav when a visitor is not signed in.
// Generic placeholder handle — assumes a seeded `bob` profile on the live
// registry. Other landing-page sample data (AfterCard, ticker, bot mocks)
// still uses `dewaxindo` and is independent of this constant.
const DEMO_PROFILE_HANDLE = 'bob';

interface NavItem {
  href: string;
  label: string;
  match?: (path: string) => boolean;
}

function isActive(path: string, item: NavItem) {
  if (item.match) return item.match(path);
  return path === item.href || path.startsWith(`${item.href}/`);
}

export function TopBar() {
  const path = usePathname() ?? '/';
  const { session } = useXSession();
  const xHandle = session?.xHandle;
  // M-01: drawer state lives here so the hamburger button + the drawer
  // backdrop stay in lockstep.
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Profile is dynamic: signed-in users get their own profile, signed-out
  // visitors see the canonical demo profile (disambiguated by the "(demo)"
  // suffix so it's clear it isn't theirs). Keeps the nav slot useful in both
  // states without auto-routing a fresh visitor to someone else's page silently.
  const profileItem: NavItem = xHandle
    ? {
        href: `/${xHandle}`,
        label: 'Profile',
        match: (p) => p === `/${xHandle}`,
      }
    : {
        href: `/${DEMO_PROFILE_HANDLE}`,
        label: 'Profile (demo)',
        match: (p) => p === `/${DEMO_PROFILE_HANDLE}`,
      };

  const nav: NavItem[] = [
    { href: '/', label: 'Home', match: (p) => p === '/' },
    { href: '/lock', label: 'Lock' },
    { href: '/leaderboard', label: 'Leaderboard' },
    profileItem,
    { href: '/bot', label: 'Check bot' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/brand', label: 'Brand' },
  ];

  // Same items, but shaped for the drawer (active flag pre-computed).
  const drawerNav = nav.map((item) => ({
    href: item.href,
    label: item.label,
    active: isActive(path, item),
  }));

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <Link href="/" className="brand-link">
            <span className="brand-mark">
              <PixelMark bitmap={BRAND_MARK} size={20} tone="on-ink" />
            </span>
            TOLDPROOF
          </Link>
          <nav className="nav-row topbar-nav-desktop">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={isActive(path, item) ? 'active' : ''}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="topbar-right">
          <div className="topbar-chrome-desktop">
            <span className="testnet-dot">
              <span className="dot" />
              testnet
            </span>
            <DarkModeToggle />
          </div>
          <WalletConnect />
          <XSignInButton size="sm" />
          <button
            type="button"
            className="topbar-hamburger"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>
      <MobileNavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        nav={drawerNav}
      />
    </>
  );
}

export function FooterBar() {
  return (
    <footer className="footer">
      <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
        <span>TOLDPROOF · v0.1 · sui:testnet · walrus:testnet · seal:testnet</span>
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
      </div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <a
          className="onchain-badge"
          href={`https://${NETWORK}.suivision.xyz/package/${PACKAGE_ID}`}
          target="_blank"
          rel="noopener noreferrer"
          title={`View on Suivision · ${PACKAGE_ID}`}
        >
          <PixelMark bitmap={SUI_MARK} size={14} />
          Package · {shortHash(PACKAGE_ID, 6, 4)}
        </a>
        <a
          className="onchain-badge"
          href="https://x.com/toldproof"
          target="_blank"
          rel="noopener noreferrer"
          title="Follow @toldproof on X"
        >
          @toldproof on X
        </a>
        <span>Sui Overflow 2026</span>
      </div>
    </footer>
  );
}
