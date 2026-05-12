// Public profile — `/[handle]` lists every prediction sealed under that X handle.
// Reads directly from the on-chain Registry's `by_handle: Table<String, vector<ID>>`.
// No Postgres dependency for the read path.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPredictionsForHandle, getSuiClientForReads } from '../../lib/registry';
import { PredictionCard } from '../../components/PredictionCard';

// Anything that isn't a plausible X handle = 404.
// X handles: alphanumeric + underscore, 1-15 chars. Hex-y addresses or words
// starting with 0x get rejected.
function isPlausibleHandle(s: string): boolean {
  if (s.startsWith('0x')) return false;
  return /^[A-Za-z0-9_]{1,15}$/.test(s);
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: raw } = await params;
  const handle = raw.toLowerCase().replace(/^@/, '');
  if (!isPlausibleHandle(handle)) notFound();

  const client = getSuiClientForReads();
  const predictions = await getPredictionsForHandle(client, handle);

  const revealedCount = predictions.filter((p) => p.revealed).length;
  const lockedCount = predictions.filter(
    (p) => !p.revealed && Date.now() < p.unlockAtMs,
  ).length;
  const awaitingRevealCount = predictions.length - revealedCount - lockedCount;

  return (
    <section className="flex flex-1 w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
          Public profile
        </p>
        <h1 className="break-words text-4xl font-bold tracking-tight">@{handle}</h1>
        {predictions.length > 0 ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {predictions.length} sealed prediction{predictions.length === 1 ? '' : 's'}
            {' · '}
            {revealedCount} revealed
            {lockedCount > 0 ? ` · ${lockedCount} sealed` : ''}
            {awaitingRevealCount > 0 ? ` · ${awaitingRevealCount} awaiting reveal` : ''}
          </p>
        ) : (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            No sealed predictions yet.
          </p>
        )}
      </div>

      {predictions.length === 0 ? (
        <div className="flex flex-col gap-4 rounded-md border border-neutral-200 p-6 text-sm dark:border-neutral-800">
          <p>
            Nothing here yet. If this is your handle, you can be first:
          </p>
          <Link
            href="/seal"
            className="self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            Seal a prediction →
          </Link>
          <p className="text-xs text-neutral-500">
            Anyone can seal under any handle. X OAuth verification is coming in Day 4 step 2 — until then, treat the
            handle field as untrusted.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {predictions.map((p) => (
            <PredictionCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </section>
  );
}
