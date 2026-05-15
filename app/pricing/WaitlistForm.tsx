'use client';

import { useState } from 'react';

type Tier = 'pro' | 'reputation-api';
type Phase = 'idle' | 'open' | 'submitting' | 'done' | 'error';

interface Props {
  tier: Tier;
  label: string;
  variant?: 'primary' | 'ghost';
  mailtoFallback: string;
}

// Inline waitlist form. Closed state shows a single "Join waitlist" button;
// clicking it expands to email + optional handle/notes. The mailto fallback
// stays visible as a small link so users on a configured mail client can
// route around the form if they prefer.
export function WaitlistForm({ tier, label, variant = 'ghost', mailtoFallback }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [email, setEmail] = useState('');
  const [xHandle, setXHandle] = useState('');
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPhase('submitting');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          email: email.trim(),
          xHandle: xHandle.trim() || undefined,
          notes: notes.trim() || undefined,
          source: 'pricing-page',
          website,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!res.ok || !data?.ok) {
        setErrorMsg(
          data?.error === 'invalid_email'
            ? 'That email doesn’t look right.'
            : 'Could not save your signup. Try again or email us directly.',
        );
        setPhase('error');
        return;
      }
      setPhase('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error.');
      setPhase('error');
    }
  }

  if (phase === 'done') {
    return (
      <div
        style={{
          padding: '12px 14px',
          border: '1px solid var(--verified)',
          background: 'var(--verified-soft)',
          borderRadius: 4,
          fontSize: 13,
          color: 'oklch(0.3 0.12 150)',
          textAlign: 'center',
        }}
      >
        ✓ You&apos;re on the list. We&apos;ll reach out from{' '}
        <strong>hi@toldproof.xyz</strong>.
      </div>
    );
  }

  if (phase === 'idle') {
    return (
      <div className="col" style={{ gap: 8 }}>
        <button
          type="button"
          className={`btn${variant === 'ghost' ? ' ghost' : ''}`}
          onClick={() => setPhase('open')}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {label}
        </button>
        <a
          href={mailtoFallback}
          className="mono"
          style={{
            fontSize: 10.5,
            color: 'var(--muted)',
            textAlign: 'center',
            textDecoration: 'underline',
            letterSpacing: '0.04em',
          }}
        >
          or email us directly
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="col"
      style={{
        gap: 8,
        padding: '14px 16px',
        border: '1px solid var(--ink)',
        borderRadius: 4,
        background: 'var(--paper)',
      }}
    >
      <input
        type="email"
        required
        autoFocus
        placeholder="you@domain.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={phase === 'submitting'}
        className="input"
        style={{ width: '100%' }}
      />
      <input
        type="text"
        placeholder="X handle (optional, no @)"
        value={xHandle}
        onChange={(e) => setXHandle(e.target.value)}
        disabled={phase === 'submitting'}
        maxLength={30}
        className="input"
        style={{ width: '100%' }}
      />
      <textarea
        placeholder={
          tier === 'pro'
            ? 'What do you write about? (optional)'
            : 'Use case + volume (optional)'
        }
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={phase === 'submitting'}
        maxLength={600}
        rows={2}
        className="textarea"
        style={{ width: '100%', minHeight: 60 }}
      />
      {/* Honeypot — hidden from humans, irresistible to bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: -9999,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
      {errorMsg && (
        <span
          className="mono"
          style={{ fontSize: 11, color: 'var(--warn)' }}
        >
          {errorMsg}
        </span>
      )}
      <div className="row" style={{ gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          className="mono"
          onClick={() => {
            setPhase('idle');
            setErrorMsg(null);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            fontSize: 11,
            textDecoration: 'underline',
            cursor: 'pointer',
            padding: 0,
          }}
          disabled={phase === 'submitting'}
        >
          cancel
        </button>
        <button
          type="submit"
          className={`btn${variant === 'ghost' ? ' ghost' : ''}`}
          disabled={phase === 'submitting' || !email.trim()}
          style={{ minWidth: 140, justifyContent: 'center' }}
        >
          {phase === 'submitting' ? 'Saving…' : 'Join waitlist'}
        </button>
      </div>
      <a
        href={mailtoFallback}
        className="mono"
        style={{
          fontSize: 10.5,
          color: 'var(--muted)',
          textAlign: 'center',
          textDecoration: 'underline',
          letterSpacing: '0.04em',
        }}
      >
        prefer email? hi@toldproof.xyz
      </a>
    </form>
  );
}
