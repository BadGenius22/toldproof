'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Manual resolve button — twin of RevealButton, but for the verdict step.
// Shows on the verify page when the prediction is revealed but not yet
// attested by the AI Resolution Agent (the "waiting in queue" state). Lets
// anyone fire the multi-agent consensus pipeline on demand.
//
// Resolve is slow — multi-agent consensus = parallel LLM tool-loops + Walrus
// PUT + Sui tx. Common end-to-end is 30-90s. Loading copy reflects that so
// the user doesn't think the click died.

interface Props {
  id: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | { kind: 'resolved' }
  | { kind: 'error'; message: string };

export function ResolveButton({ id }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function resolve() {
    setState({ kind: 'resolving' });
    try {
      const res = await fetch(`/api/resolve/${id}`, { method: 'POST' });
      const data = (await res.json()) as
        | { ok: true; hit: boolean; reasoningBlobId: string }
        | { error: string; detail?: string };

      if (!res.ok || !('ok' in data)) {
        const errMsg = 'error' in data ? errorToHuman(data.error, data.detail) : "couldn't get verdict";
        setState({ kind: 'error', message: errMsg });
        return;
      }

      setState({ kind: 'resolved' });
      router.refresh();
      // Hard-reload fallback — same belt-and-suspenders pattern as the reveal
      // button. If the soft refresh leaves stale data, the reload wins.
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

  if (state.kind === 'resolving') {
    return (
      <span
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        AI judges deliberating… (30-90s · consensus + Walrus + Sui)
      </span>
    );
  }

  if (state.kind === 'resolved') {
    return (
      <span
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--verified)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        Verdict in ✓ refreshing…
      </span>
    );
  }

  return (
    <div className="col" style={{ gap: 6, alignItems: 'flex-end' }}>
      <button
        type="button"
        onClick={resolve}
        className="btn"
        style={{ fontSize: 12, padding: '6px 12px' }}
      >
        Get verdict now ↓
      </button>
      {state.kind === 'error' && (
        <span
          className="mono"
          style={{ fontSize: 10, color: 'var(--warn)', maxWidth: 280, textAlign: 'right' }}
        >
          {state.message}
        </span>
      )}
    </div>
  );
}

function errorToHuman(code: string, detail?: string): string {
  switch (code) {
    case 'already_resolved':
      return 'verdict already in — refresh the page';
    case 'not_yet_revealed':
      return 'prediction must be opened first';
    case 'resolver_misconfigured':
      return detail ?? 'resolver keypair mismatch — see server logs';
    case 'invalid_id':
      return 'invalid prediction id';
    case 'resolve_failed':
      return detail ? `failed: ${detail.slice(0, 80)}` : "couldn't get verdict";
    default:
      return code;
  }
}
