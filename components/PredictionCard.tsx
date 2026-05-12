import Link from 'next/link';
import type { PredictionView } from '../lib/registry';

function fmt(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function timeUntil(ms: number): string {
  const delta = ms - Date.now();
  if (delta <= 0) return 'unlocked';
  const m = Math.floor(delta / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function PredictionCard({ p }: { p: PredictionView }) {
  const now = Date.now();
  const unlocked = now >= p.unlockAtMs;
  const status: { label: string; tone: 'sealed' | 'unlocked' | 'revealed' } = p.revealed
    ? { label: 'Revealed', tone: 'revealed' }
    : unlocked
      ? { label: 'Unlocked · awaiting reveal', tone: 'unlocked' }
      : { label: `Sealed · unlocks in ${timeUntil(p.unlockAtMs)}`, tone: 'sealed' };

  const tone = {
    sealed:
      'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900',
    unlocked:
      'border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950',
    revealed:
      'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950',
  }[status.tone];

  return (
    <Link
      href={`/verify/${p.id}`}
      className={`flex flex-col gap-3 rounded-md border p-4 transition hover:border-black dark:hover:border-white ${tone}`}
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-mono text-neutral-500">{fmt(p.sealedAtMs)}</span>
        <span className="font-mono">{status.label}</span>
      </div>

      {p.revealed ? (
        <p className="font-mono text-base leading-snug">{p.revealedPlaintext}</p>
      ) : (
        <p className="font-mono text-base leading-snug text-neutral-400">
          ▢▢▢▢▢ encrypted until {fmt(p.unlockAtMs)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
        <span className="font-mono">
          {p.id.slice(0, 10)}…{p.id.slice(-6)}
        </span>
        <span className="hidden md:inline">·</span>
        <span className="hidden font-mono md:inline">
          sha256:{p.contentHashHex.slice(0, 12)}…
        </span>
        <span className="hidden md:inline">·</span>
        <span className="hidden md:inline">walrus:{p.blobId.slice(0, 10)}…</span>
      </div>
    </Link>
  );
}
