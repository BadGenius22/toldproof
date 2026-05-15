'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
// useRouter is kept for the initial soft refresh attempt; a hard
// window.location.reload() fires shortly after as a guaranteed fallback in
// case the Sui RPC the page reads from hasn't propagated the new revealed
// state to its cache yet on the very next request.

// Manual reveal button. Shows on the verify page when the prediction is past
// its unlock time but not yet revealed by the cron (the "Ready to open · posting
// soon" state). Lets the owner — or anyone, since Seal is the security gate —
// crank the reveal pipeline on demand.
//
// On click: POST /api/reveal/[id], wait for the Move tx, then router.refresh()
// so the parent server component re-fetches the on-chain object and renders
// the now-revealed plaintext.

interface Props {
  id: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'revealing' }
  | { kind: 'revealed' }
  | { kind: 'error'; message: string };

export function RevealButton({ id }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function reveal() {
    setState({ kind: 'revealing' });
    try {
      const res = await fetch(`/api/reveal/${id}`, { method: 'POST' });
      const data = (await res.json()) as
        | { ok: true; digest: string; plaintext: string }
        | { error: string; detail?: string };

      if (!res.ok || !('ok' in data)) {
        const errMsg = 'error' in data ? errorToHuman(data.error, data.detail) : 'reveal failed';
        setState({ kind: 'error', message: errMsg });
        return;
      }

      setState({ kind: 'revealed' });
      // Soft refresh first — re-runs the server component so the revealed block
      // renders in-place without a flash. Some configurations (load-balanced
      // fullnode pools, residual segment cache in dev) can leave the soft path
      // showing stale state; the hard reload below is the always-works fallback.
      router.refresh();
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e) {
      setState({
        kind: 'error',
        message: e instanceof Error ? e.message : 'network error — try again',
      });
    }
  }

  if (state.kind === 'revealing') {
    return (
      <span
        className="mono"
        style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}
      >
        Opening… (≈10s — Seal + Walrus + Sui)
      </span>
    );
  }

  if (state.kind === 'revealed') {
    return (
      <span
        className="mono"
        style={{ fontSize: 11, color: 'var(--verified)', textTransform: 'uppercase', letterSpacing: '0.1em' }}
      >
        Opened ✓ refreshing…
      </span>
    );
  }

  return (
    <div className="col" style={{ gap: 6, alignItems: 'flex-end' }}>
      <button
        type="button"
        onClick={reveal}
        className="btn"
        style={{ fontSize: 12, padding: '6px 12px' }}
      >
        Open now ↓
      </button>
      {state.kind === 'error' && (
        <span
          className="mono"
          style={{ fontSize: 10, color: 'var(--warn)', maxWidth: 260, textAlign: 'right' }}
        >
          {state.message}
        </span>
      )}
    </div>
  );
}

function errorToHuman(code: string, detail?: string): string {
  switch (code) {
    case 'already_revealed':
      return 'already opened — refresh the page';
    case 'not_yet_unlocked':
      return 'unlock time not yet reached';
    case 'invalid_id':
      return 'invalid prediction id';
    case 'reveal_failed':
      return detail ? `failed: ${detail.slice(0, 80)}` : 'reveal failed';
    default:
      return code;
  }
}
