'use client';

import { useEffect, useState } from 'react';

// Spec: docs/design/WAITLIST_FORM.md
// Inline expand → 1-field form → green confirmation pill. No modal.
// Confirmed state persists across reloads via localStorage so a returning
// user sees the pill, not the form.

interface Props {
  tier: 'pro' | 'reputation-api';
  label?: string;
  variant?: 'primary' | 'ghost';
}

export function WaitlistForm({
  tier,
  label = 'Join waitlist',
  variant = 'ghost',
}: Props) {
  const storageKey = `waitlist:${tier}`;
  const [phase, setPhase] = useState<
    'idle' | 'open' | 'submitting' | 'done' | 'error'
  >('idle');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);

  // Restore confirmed state across reloads.
  useEffect(() => {
    try {
      const prior = localStorage.getItem(storageKey);
      if (prior) {
        setSavedEmail(prior);
        setPhase('done');
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setPhase('submitting');
    setError(null);
    try {
      const res = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, email: email.trim(), honeypot: '' }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!res.ok || !data?.ok) {
        setError(
          data?.error === 'invalid_email'
            ? "That doesn't look like an email."
            : "Couldn't save that. Try again?",
        );
        setPhase('error');
        return;
      }
      try {
        localStorage.setItem(storageKey, email.trim());
      } catch {
        /* ignore */
      }
      setSavedEmail(email.trim());
      setPhase('done');
    } catch {
      setError("Couldn't reach the server. Try again?");
      setPhase('error');
    }
  }

  if (phase === 'done' && savedEmail) {
    return (
      <div className="waitlist-confirmed mono">
        ✓ You&apos;re on the list. We&apos;ll email{' '}
        <strong>{savedEmail}</strong> when it ships.
      </div>
    );
  }

  if (phase === 'idle') {
    return (
      <button
        type="button"
        className={`btn ${variant}`}
        onClick={() => setPhase('open')}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {label}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="waitlist-form">
      <label className="hint mono" htmlFor={`waitlist-${tier}`}>
        We&apos;ll email you when this opens. No spam.
      </label>
      <div className="waitlist-row">
        <input
          id={`waitlist-${tier}`}
          className="input"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={phase === 'submitting'}
          autoFocus
        />
        {/* Honeypot — hidden from real users, bots fill it. */}
        <input
          type="text"
          name="honeypot"
          tabIndex={-1}
          autoComplete="off"
          style={{
            position: 'absolute',
            left: -9999,
            width: 1,
            height: 1,
            opacity: 0,
          }}
          aria-hidden="true"
        />
        <button
          type="submit"
          className="btn"
          disabled={phase === 'submitting' || !email.trim()}
        >
          {phase === 'submitting' ? 'Saving…' : 'Notify me'}
        </button>
      </div>
      {error && (
        <span className="hint" style={{ color: 'var(--warn)' }}>
          {error}
        </span>
      )}
      <button
        type="button"
        className="waitlist-cancel mono"
        onClick={() => setPhase('idle')}
      >
        ← nevermind
      </button>
    </form>
  );
}
