'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PixelMark } from './PixelMark';
import { BRAND_MARK, SUI_MARK } from './bitmaps';
import { DarkModeToggle } from './DarkModeToggle';
import { WalletConnect } from '../WalletConnect';
import { shortHash } from './format';

// Default to the audited testnet deployment so the badge still works on
// previews where NEXT_PUBLIC_* may not be inlined yet.
const FALLBACK_PACKAGE_ID =
  '0x97b738cecf808f17a80fabd55726df2ab31c97ec314c04e4810d5a504c3bd221';
const PACKAGE_ID =
  process.env.NEXT_PUBLIC_TOLDPROOF_PACKAGE_ID || FALLBACK_PACKAGE_ID;
const NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet';

interface NavItem {
  href: string;
  label: string;
  match?: (path: string) => boolean;
}

const NAV: NavItem[] = [
  { href: '/', label: 'Home', match: (p) => p === '/' },
  { href: '/seal', label: 'Lock' },
  // Profile, bot, reveal, reputation, brand all live at named routes
  { href: '/dewaxindo', label: 'Profile', match: (p) => p === '/dewaxindo' },
  { href: '/bot', label: 'Check bot' },
  { href: '/reveal', label: 'Open it' },
  { href: '/reputation', label: 'Score' },
  { href: '/brand', label: 'Brand' },
];

function isActive(path: string, item: NavItem) {
  if (item.match) return item.match(path);
  return path === item.href || path.startsWith(`${item.href}/`);
}

export function TopBar() {
  const path = usePathname() ?? '/';
  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link href="/" className="brand-link">
          <span className="brand-mark">
            <PixelMark bitmap={BRAND_MARK} size={20} color="var(--paper)" />
          </span>
          TOLDPROOF
        </Link>
        <nav className="nav-row">
          {NAV.map((item) => (
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
        <span className="testnet-dot">
          <span className="dot" />
          testnet
        </span>
        <DarkModeToggle />
        <WalletConnect />
      </div>
    </header>
  );
}

export function FooterBar() {
  return (
    <footer className="footer">
      <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
        <span>TOLDPROOF · v0.1 · sui:testnet · walrus:testnet · seal:testnet</span>
      </div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <a
          className="onchain-badge"
          href={`https://${NETWORK}.suivision.xyz/package/${PACKAGE_ID}`}
          target="_blank"
          rel="noopener noreferrer"
          title={`View on Suivision · ${PACKAGE_ID}`}
        >
          <PixelMark bitmap={SUI_MARK} size={14} color="var(--ink)" />
          Package · {shortHash(PACKAGE_ID, 6, 4)}
        </a>
        <span>Sui Overflow 2026</span>
      </div>
    </footer>
  );
}
