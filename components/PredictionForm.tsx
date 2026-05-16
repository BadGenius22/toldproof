'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CurrentAccountSigner,
  useCurrentAccount,
  useDAppKit,
} from '@mysten/dapp-kit-react';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { sealPredictionTx } from '../lib/sui';
import { aesGcmEncrypt, randomAesKey, sha256 } from '../lib/crypto';
import { storeBlob, epochsForUnlock } from '../lib/walrus';
import { getSealClient, encryptAesKey } from '../lib/seal';
import { env } from '../lib/env';
import { useXSession, startXOAuth } from '../lib/useXSession';
import { useQuota } from '../lib/useQuota';
import {
  Chip,
  PageEyebrow,
  Perforation,
  PixelMark,
  PIXEL_LOCK,
  ReceiptRow,
  BRAND_MARK,
  fakeHexBlock,
  fmtAbs,
  shortHash,
} from './design';

type Step =
  | 'idle'
  | 'encrypting'
  | 'uploading'
  | 'sealing'
  | 'signing'
  | 'confirming'
  | 'done'
  | 'error';

// Maps the real pipeline phase to the visual step indicator.
const STEP_LABELS: { id: Exclude<Step, 'idle' | 'done' | 'error'>; label: string; detail: string }[] = [
  { id: 'encrypting', label: 'Scramble the text', detail: 'Scrambling the words inside your browser. Nothing leaves your machine yet.' },
  { id: 'uploading', label: 'Send to Walrus', detail: 'Uploading the scrambled text to Walrus storage.' },
  { id: 'sealing', label: 'Lock the key', detail: 'Handing the key to Seal so nobody can read it until the open time.' },
  { id: 'signing', label: 'Sign with your wallet', detail: 'Approve the wallet pop-up to record this on Sui.' },
  { id: 'confirming', label: 'Save on Sui', detail: 'Waiting for the Sui network to confirm.' },
];

function stepIndexOf(step: Step): number {
  if (step === 'idle') return -1;
  if (step === 'done') return STEP_LABELS.length;
  if (step === 'error') return -1;
  return STEP_LABELS.findIndex((s) => s.id === step);
}

// datetime-local expects LOCAL time formatted "YYYY-MM-DDTHH:mm" — not UTC.
// toISOString() returns UTC and would be off by the user's timezone offset.
function formatLocalDatetimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function defaultUnlockLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0);
  d.setMilliseconds(0);
  return formatLocalDatetimeInput(d);
}

// NEXT_PUBLIC_* are inlined at build time for client bundles. Reading them
// here (inside the component, post-build) is safe; doing it at module-top
// breaks Turbopack's client-component pre-evaluation in dev SSR.
const RPC_URL = process.env.NEXT_PUBLIC_SUI_RPC ?? 'https://fullnode.testnet.sui.io:443';
const NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? 'testnet') as
  | 'testnet'
  | 'mainnet'
  | 'devnet'
  | 'localnet';

export function PredictionForm() {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const { session, knownBinding } = useXSession();
  const { quota, refetch: refetchQuota } = useQuota();
  const [suiClient] = useState(
    () => new SuiJsonRpcClient({ url: RPC_URL, network: NETWORK }),
  );

  const [text, setText] = useState('');
  // LK-06: structured-prediction mode. Free-text remains the default; users
  // can flip to structured for one-line falsifiable claims like
  // `BTC > 95000 by 2026-06-30`. Switching back leaves the existing text
  // intact so users don't lose typing.
  const [mode, setMode] = useState<'free' | 'structured'>('free');
  const [sTicker, setSTicker] = useState('BTC');
  const [sOtherTicker, setSOtherTicker] = useState('');
  const [sOp, setSOp] = useState<'>' | '<' | '>=' | '<='>('>');
  const [sValue, setSValue] = useState('');
  const [sByDate, setSByDate] = useState('');
  useEffect(() => {
    if (mode !== 'structured') return;
    const t = sTicker === 'OTHER' ? sOtherTicker.trim().toUpperCase() : sTicker;
    if (!t || !sValue || !sByDate) return;
    setText(`${t} ${sOp} ${sValue} by ${sByDate}`);
  }, [mode, sTicker, sOtherTicker, sOp, sValue, sByDate]);
  const [unlockIso, setUnlockIso] = useState('');
  useEffect(() => {
    setUnlockIso((prev) => prev || defaultUnlockLocal());
  }, []);
  const [xHandle, setXHandle] = useState('');
  // Auto-fill + lock the X handle. Two sources, session takes priority:
  //   1. Active OAuth session — authoritative, gates seal submission.
  //   2. knownBinding — the wallet has a prior DB binding but the cookie
  //      session is gone (e.g. user just reconnected the wallet). Surfaces
  //      the handle visually so the form isn't blank during the
  //      "welcome back, click to re-sign-in" state.
  // The seal-gate API does the authoritative check at submit time; this
  // is purely a UX pre-fill.
  const knownHandle = session?.xHandle ?? knownBinding?.xHandle ?? '';
  useEffect(() => {
    if (knownHandle) setXHandle(knownHandle);
  }, [knownHandle]);
  // "Locked" if we have any OAuth-derived identity to show, regardless of
  // whether the live session is active. Submit still gates on session via
  // /api/seal/preflight.
  const handleLocked = !!knownHandle;
  const [autoTweet, setAutoTweet] = useState(true);

  // Price-hint nudge: when the prediction text mentions a known ticker AND a
  // threshold, the server fetches the current price and computes whether the
  // call is "already true" right now. Surfaces under the textarea as a soft
  // warning — never blocks submission.
  const [priceHints, setPriceHints] = useState<
    Array<{ ticker: string; message: string; alreadyTrue?: boolean }>
  >([]);
  useEffect(() => {
    const snippet = text.trim();
    if (snippet.length < 3) {
      // Clear stale hints when user shortens the text. Wrap in a microtask
      // so we're not synchronously setting state inside the effect body
      // (which the react-hooks/set-state-in-effect rule rejects); behavior
      // is identical from the user's perspective.
      const clear = setTimeout(() => setPriceHints([]), 0);
      return () => clearTimeout(clear);
    }
    // Debounce — avoid hammering /api/seal/price-hint on every keystroke.
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/seal/price-hint?text=${encodeURIComponent(snippet)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok: boolean;
          hints: Array<{ ticker: string; message: string; alreadyTrue?: boolean }>;
        };
        if (data.ok) setPriceHints(data.hints);
      } catch {
        // Best-effort hint — silent on network failure.
      }
    }, 500);
    return () => clearTimeout(t);
  }, [text]);

  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    predictionId: string;
    blobId: string;
    contentHashHex: string;
    sealedAtMs: number;
    unlockAtMs: number;
    xHandle: string;
  } | null>(null);
  // Auto-tweet status — separate from the seal result so we can surface
  // posting errors (e.g. scope_missing, credits_depleted) without breaking
  // the seal receipt.
  const [tweetState, setTweetState] = useState<
    | { kind: 'idle' }
    | { kind: 'posting' }
    | { kind: 'posted'; url: string }
    | { kind: 'scope_missing' }
    | { kind: 'credits_depleted' }
    | { kind: 'failed'; detail: string }
  >({ kind: 'idle' });

  const running = step !== 'idle' && step !== 'done' && step !== 'error';
  const disabled = running;
  const charsLeft = 280 - text.length;
  const stepIdx = stepIndexOf(step);

  async function postTweet(predictionId: string, unlockAtMs: number) {
    setTweetState({ kind: 'posting' });
    try {
      const res = await fetch('/api/x/post-tweet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictionId, unlockAtMs }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.tweet?.url) {
        setTweetState({ kind: 'posted', url: data.tweet.url });
      } else if (data?.error === 'scope_missing') {
        setTweetState({ kind: 'scope_missing' });
      } else if (data?.error === 'credits_depleted') {
        setTweetState({ kind: 'credits_depleted' });
      } else {
        setTweetState({
          kind: 'failed',
          detail: data?.detail ?? 'Could not post tweet',
        });
      }
    } catch (err) {
      setTweetState({
        kind: 'failed',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!account) {
      setError('Please connect a wallet first.');
      setStep('error');
      return;
    }
    setError(null);
    setResult(null);

    try {
      const unlockMs = new Date(unlockIso).getTime();
      if (Number.isNaN(unlockMs) || unlockMs <= Date.now() + 30_000) {
        throw new Error('The open time must be at least 30 seconds from now.');
      }
      const unlockAtMs = BigInt(unlockMs);
      const cleanHandle = xHandle.trim().toLowerCase().replace(/^@/, '');
      if (!cleanHandle) throw new Error('Please enter your X handle.');

      // 0. Seal-gate preflight — verify (a) the user is signed in with X and
      // the handle matches their OAuth session, and (b) the user has free
      // quota remaining this month. Prevents both the squat path
      // ("type @vitalik even though my X is @random123") and unbounded free
      // sealing. The Move contract is permissionless; this is API-level only.
      const preflightRes = await fetch('/api/seal/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: account.address,
          identity: cleanHandle,
        }),
      });
      if (!preflightRes.ok) {
        const data = (await preflightRes.json().catch(() => null)) as
          | { error?: string; boundHandle?: string }
          | null;
        if (data?.error === 'no_session') {
          throw new Error(
            'Sign in with X first — click the X button at the top to bind your handle.',
          );
        }
        if (data?.error === 'handle_mismatch' && data.boundHandle) {
          throw new Error(
            `Your X account is @${data.boundHandle}. Use that handle, or sign out and sign in with the X account for @${cleanHandle}.`,
          );
        }
        if (data?.error === 'wallet_mismatch') {
          throw new Error(
            'This wallet is not bound to your X account. Sign in with X again from this wallet, or switch wallets.',
          );
        }
        throw new Error('Could not verify your X account. Please refresh and try again.');
      }
      const preflight = (await preflightRes.json()) as {
        mode: 'free' | 'overage';
        freeRemaining: number;
        freeLimit: number;
        overagePriceUsd: number;
      };
      // Hackathon scope: only the free path is wired through the UI today.
      // Overage payment via seal_prediction_paid<T> ships in Phase 5c.
      if (preflight.mode === 'overage') {
        throw new Error(
          `You have used all ${preflight.freeLimit} free predictions this month. ` +
            `Overage at $${preflight.overagePriceUsd.toFixed(2)}/seal lands next — ` +
            'or upgrade to Pro for 100/month (waitlist on /pricing).',
        );
      }

      // 1. AES envelope
      setStep('encrypting');
      const plaintext = new TextEncoder().encode(text);
      const aesKey = randomAesKey();
      const ciphertext = await aesGcmEncrypt(plaintext, aesKey);
      const contentHash = await sha256(plaintext);

      // 2. Walrus — size storage to outlive the unlock window
      setStep('uploading');
      const epochs = epochsForUnlock(Number(unlockAtMs));
      const { blobId } = await storeBlob(ciphertext, epochs);

      // 3. Seal-encrypt the AES key
      setStep('sealing');
      const seal = getSealClient(suiClient);
      const sealedKey = await encryptAesKey({
        seal,
        aesKey,
        unlockAtMs,
        packageId: env.packageId,
      });

      // 4. Sui Move call — wallet popup
      setStep('signing');
      const tx = sealPredictionTx({
        registryId: env.registryId,
        packageId: env.packageId,
        xHandle: cleanHandle,
        unlockAtMs,
        contentHash,
        blobIdBytes: new TextEncoder().encode(blobId),
        sealedKey,
      });

      const signer = new CurrentAccountSigner(dAppKit);
      const signed = await signer.signAndExecuteTransaction({ transaction: tx });
      if (signed.$kind !== 'Transaction') {
        throw new Error('Sui could not save the prediction. Please try again.');
      }
      const digest = signed.Transaction.digest;

      // 5. Confirm + pull objectChanges via follow-up RPC
      setStep('confirming');
      await suiClient.waitForTransaction({ digest });
      const details = await suiClient.getTransactionBlock({
        digest,
        options: { showObjectChanges: true },
      });
      const created = details.objectChanges?.find(
        (c: { type: string; objectId?: string; objectType?: string }) =>
          c.type === 'created' &&
          typeof c.objectType === 'string' &&
          c.objectType.endsWith('::prediction_vault::SealedPrediction'),
      ) as { type: 'created'; objectId: string; objectType: string } | undefined;
      if (!created) {
        throw new Error('Transaction succeeded but no SealedPrediction was created');
      }

      const contentHashHex = Array.from(contentHash)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      setStep('done');
      setResult({
        predictionId: created.objectId,
        blobId,
        contentHashHex,
        sealedAtMs: Date.now(),
        unlockAtMs: Number(unlockAtMs),
        xHandle: cleanHandle,
      });

      // Fire-and-forget quota increment. Failure is non-fatal — the on-chain
      // seal is already final; we just lose accuracy on the off-chain counter
      // (gets corrected on next preflight read).
      void fetch('/api/seal/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'free' }),
      })
        .then(() => refetchQuota())
        .catch(() => {});

      // Auto-tweet if opted in. Independent from quota record + nav — failure
      // here doesn't block the receipt. We update tweetState so the success
      // screen can render the resulting tweet URL or the re-auth nudge.
      if (autoTweet) {
        void postTweet(created.objectId, Number(unlockAtMs));
      }

      // LK-08: receipt stays visible indefinitely. The user controls when to
      // navigate via the explicit "View receipt →" CTA on the receipt itself.
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
      setStep('error');
    }
  }

  function reset() {
    setStep('idle');
    setError(null);
    setResult(null);
    setTweetState({ kind: 'idle' });
  }

  return (
    <div className="page">
      <div className="container">
        <div
          className="row"
          style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <PageEyebrow>Lock a prediction</PageEyebrow>
          {quota && (
            <span
              className="mono"
              style={{
                padding: '3px 10px',
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: 'var(--paper-2)',
                fontSize: 10.5,
                color:
                  quota.mode === 'overage' ? 'var(--warn)' : 'var(--ink-3)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
              title="Free monthly quota"
            >
              {quota.freeUsed}/{quota.freeLimit} free
              {quota.mode === 'overage' &&
                ` · overage $${quota.overagePriceUsd.toFixed(2)}`}
            </span>
          )}
        </div>
        <h1
          className="display"
          style={{ fontSize: 'clamp(34px, 5vw, 56px)', marginTop: 12 }}
        >
          Write it now. Prove it later.
        </h1>
        <p
          style={{
            marginTop: 18,
            fontSize: 16,
            color: 'var(--ink-3)',
            lineHeight: 1.55,
            maxWidth: 560,
          }}
        >
          Scrambled in your browser. Saved on Walrus. The key is locked
          away until the open date you choose. Until then, nobody — not even you —
          can read it.
        </p>

        <div className="mt-24">
          <ReadinessGate
            account={account}
            session={session}
            knownBinding={knownBinding}
            onStartOAuth={() => {
              if (account) void startXOAuth(account.address);
            }}
          />
        </div>

        {account && session && (
        <form id="lock-form" onSubmit={handleSubmit} className="mt-32 seal-layout">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 18,
              minWidth: 0,
            }}
          >
            <div className="field">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label htmlFor="pred">Your prediction</label>
                <div className="row" style={{ gap: 0 }}>
                  <button
                    type="button"
                    onClick={() => setMode('free')}
                    className={`filter-tab${mode === 'free' ? ' active' : ''}`}
                  >
                    Free text
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('structured')}
                    className={`filter-tab${mode === 'structured' ? ' active' : ''}`}
                  >
                    Structured
                  </button>
                </div>
              </div>
              {mode === 'structured' && (
                <div
                  className="row"
                  style={{
                    gap: 8,
                    flexWrap: 'wrap',
                    padding: 10,
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    background: 'var(--paper-2)',
                    marginBottom: 8,
                  }}
                >
                  <select
                    className="input"
                    value={sTicker}
                    onChange={(e) => setSTicker(e.target.value)}
                    disabled={disabled || !!result}
                    style={{ width: 110 }}
                  >
                    {['BTC', 'ETH', 'SUI', 'SOL', 'WAL', 'USDC', 'DOGE', 'OTHER'].map(
                      (t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ),
                    )}
                  </select>
                  {sTicker === 'OTHER' && (
                    <input
                      type="text"
                      className="input"
                      placeholder="TICKER"
                      value={sOtherTicker}
                      onChange={(e) => setSOtherTicker(e.target.value)}
                      disabled={disabled || !!result}
                      style={{ width: 120 }}
                    />
                  )}
                  <select
                    className="input"
                    value={sOp}
                    onChange={(e) => setSOp(e.target.value as typeof sOp)}
                    disabled={disabled || !!result}
                    style={{ width: 80 }}
                  >
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value=">=">&ge;</option>
                    <option value="<=">&le;</option>
                  </select>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input"
                    placeholder="value"
                    value={sValue}
                    onChange={(e) => setSValue(e.target.value)}
                    disabled={disabled || !!result}
                    style={{ width: 140 }}
                  />
                  <span className="mono" style={{ color: 'var(--muted)' }}>by</span>
                  <input
                    type="date"
                    className="input"
                    value={sByDate}
                    onChange={(e) => setSByDate(e.target.value)}
                    disabled={disabled || !!result}
                    style={{ width: 170 }}
                  />
                </div>
              )}
              <textarea
                id="pred"
                className="textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={280}
                disabled={disabled || !!result || mode === 'structured'}
                required
                placeholder="BTC > 95k by 2026-06-30"
              />
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="hint">
                  {mode === 'structured'
                    ? 'Read-only — edit the fields above. Switch to Free text to type freely.'
                    : '280 letters max — same as X.'}
                </span>
                <span className="hint">{charsLeft} left</span>
              </div>
              {priceHints.length > 0 && (
                <div
                  className="col"
                  style={{ gap: 6, marginTop: 4 }}
                  aria-live="polite"
                >
                  {priceHints.map((h) => (
                    <div
                      key={h.ticker}
                      style={{
                        border: '1px dashed',
                        borderColor: h.alreadyTrue ? 'var(--warn)' : 'var(--border)',
                        background: h.alreadyTrue ? 'var(--warn-soft, #fff7e6)' : 'var(--paper-2)',
                        borderRadius: 4,
                        padding: '8px 12px',
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: h.alreadyTrue ? 'var(--ink)' : 'var(--ink-2)',
                        fontFamily: 'var(--font-mono), monospace',
                      }}
                    >
                      <span style={{ marginRight: 6 }}>
                        {h.alreadyTrue ? '⚠' : 'ℹ'}
                      </span>
                      {h.message}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="seal-fields-2">
              <div className="field">
                <label htmlFor="handle">Your X handle</label>
                <input
                  id="handle"
                  className="input"
                  // The handle is ALWAYS controlled by OAuth — never editable.
                  // If signed in, it shows the bound handle. If not, the
                  // field is empty + disabled, prompting sign-in.
                  value={handleLocked ? xHandle : ''}
                  onChange={() => {
                    /* read-only — controlled by OAuth session */
                  }}
                  disabled
                  readOnly
                  required
                  placeholder={
                    handleLocked ? 'elonmusk' : '(Sign in with X to set your handle)'
                  }
                />
                <span className="hint">
                  {session
                    ? `Linked to your X account ✓ — your prediction will be filed under @${xHandle}.`
                    : knownBinding
                    ? `This wallet is bound to @${knownBinding.xHandle}. Sign in (top of page) to restore your session before sealing.`
                    : 'Sign in with X (top of page) to claim your handle. We auto-fill it from your account so nobody else can.'}
                </span>
                {quota && (
                  <span
                    className="mono"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 6,
                      padding: '3px 10px',
                      border: `1px solid ${
                        quota.mode === 'overage'
                          ? 'var(--danger, #c25400)'
                          : 'var(--ink)'
                      }`,
                      borderRadius: 999,
                      fontSize: 10.5,
                      color:
                        quota.mode === 'overage'
                          ? 'var(--danger, #c25400)'
                          : 'var(--ink)',
                      width: 'fit-content',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {quota.mode === 'overage'
                      ? `${quota.freeUsed}/${quota.freeLimit} free used · overage $${quota.overagePriceUsd.toFixed(2)}`
                      : `${quota.freeUsed}/${quota.freeLimit} free this month`}
                  </span>
                )}
              </div>
              <div className="field">
                <label htmlFor="unlock">Open it on</label>
                <input
                  id="unlock"
                  className="input"
                  type="datetime-local"
                  value={unlockIso}
                  onChange={(e) => setUnlockIso(e.target.value)}
                  disabled={disabled || !!result}
                  required
                />
                <span className="hint">Pick a time at least 30 seconds from now.</span>
              </div>
            </div>

            <div className="col" style={{ gap: 6 }}>
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  color: 'var(--muted)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Or pick a shortcut
              </span>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {/* LK-07: commit harder to the date-chips path. Includes EOY
                    so analysts can lock year-end calls in one click. */}
                {(
                  [
                    { label: '+5 min', ms: 5 * 60_000 },
                    { label: '+1 hr', ms: 60 * 60_000 },
                    { label: '+1 day', ms: 24 * 60 * 60_000 },
                    { label: '+1 week', ms: 7 * 24 * 60 * 60_000 },
                    { label: '+1 month', ms: 30 * 24 * 60 * 60_000 },
                    { label: 'EOY', ms: 'eoy' as const },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="filter-tab"
                    disabled={disabled || !!result}
                    onClick={() => {
                      let d: Date;
                      if (p.ms === 'eoy') {
                        d = new Date(new Date().getFullYear(), 11, 31, 23, 59);
                      } else {
                        d = new Date(Date.now() + (p.ms as number));
                      }
                      d.setSeconds(0);
                      d.setMilliseconds(0);
                      setUnlockIso(formatLocalDatetimeInput(d));
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <label
              className="row"
              style={{
                gap: 10,
                cursor: 'pointer',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 4,
              }}
            >
              <input
                type="checkbox"
                checked={autoTweet}
                onChange={(e) => setAutoTweet(e.target.checked)}
                disabled={disabled || !!result}
                style={{ accentColor: 'var(--ink)' }}
              />
              <div className="col" style={{ gap: 2 }}>
                <span className="mono" style={{ fontSize: 12 }}>
                  Post a tweet when I lock it
                </span>
                <span className="hint" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  We&apos;ll post from your linked X account once your account is connected.
                </span>
              </div>
            </label>

            {!result && (
              <button
                type="submit"
                className="btn lg lock-submit-btn"
                disabled={disabled}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <PixelMark bitmap={PIXEL_LOCK} size={14} color="currentColor" />
                Lock my prediction
              </button>
            )}
          </div>

          <details className="tweet-preview-acc">
            <summary>Preview the tweet ↓</summary>
            <div className="tweet-preview-acc-body">
              <TweetPreview
                text={text}
                handle={xHandle}
                unlockIso={unlockIso}
                autoTweet={autoTweet}
              />
            </div>
          </details>
        </form>
        )}

        {/* M-04: fixed-bottom CTA on mobile. The in-flow submit button is
            hidden below --bp-md via CSS; this bar replaces it with a
            thumb-friendly target that stays glued above the iOS home
            indicator (env(safe-area-inset-bottom)). */}
        {account && session && !result && (
          <div className="lock-mobile-bar">
            <button
              type="submit"
              form="lock-form"
              className="btn lg"
              disabled={disabled}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
            >
              <PixelMark bitmap={PIXEL_LOCK} size={14} color="currentColor" />
              Lock my prediction
            </button>
          </div>
        )}

        {/* LK-05: agent footer — one-liner under the form, not above. */}
        <p
          className="mono"
          style={{
            marginTop: 16,
            fontSize: 11.5,
            color: 'var(--muted)',
            letterSpacing: '0.04em',
          }}
        >
          Are you an AI agent? Skip the form — plug into{' '}
          <Link href="/agents" style={{ color: 'var(--ink-2)' }}>
            <code style={{ color: 'var(--sealed)' }}>/api/mcp/mcp</code>
          </Link>{' '}
          and pay $0.10 USDC per prediction.
        </p>

        {/* Pipeline — single thin progress bar (LK-04). Hex animation cut. */}
        {(running || result) && (
          <div
            className="mt-32"
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <PageEyebrow>{result ? 'Locked' : 'Locking…'}</PageEyebrow>
            <ThinPipeline stepIdx={stepIdx} done={!!result} />
          </div>
        )}

        {step === 'error' && error && (
          <div
            className="mt-24"
            style={{
              padding: '14px 16px',
              border: '1px solid var(--warn)',
              background: 'var(--warn-soft)',
              borderRadius: 4,
              color: 'oklch(0.3 0.14 30)',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <strong>Locking failed</strong>
            <span>{error}</span>
            <button
              type="button"
              className="btn ghost"
              onClick={reset}
              style={{ alignSelf: 'flex-start', marginTop: 6 }}
            >
              Try again
            </button>
          </div>
        )}

        {result && (
          <div className="mt-24">
            <div className="receipt receipt-settle">
              <div className="receipt-header">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <PixelMark bitmap={BRAND_MARK} size={14} tone="on-ink" />
                  Your receipt
                </span>
                <Chip status="sealed">Locked</Chip>
              </div>
              <div className="receipt-body">
                <dl style={{ margin: 0 }}>
                  <ReceiptRow
                    k="Prediction ID"
                    v={shortHash(result.predictionId, 16, 10)}
                  />
                  <ReceiptRow k="X handle" v={`@${result.xHandle}`} />
                  <ReceiptRow k="Locked at" v={fmtAbs(result.sealedAtMs)} />
                  <ReceiptRow k="Opens on" v={fmtAbs(result.unlockAtMs)} />
                  <ReceiptRow k="Text fingerprint" v={result.contentHashHex} />
                  <ReceiptRow k="Walrus storage ID" v={result.blobId} />
                </dl>
              </div>
              <Perforation />
              <div
                className="receipt-body row"
                style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
              >
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Anyone with this ID can check it. Nobody can read it until the open date.
                </span>
                <div className="row" style={{ gap: 8 }}>
                  <button type="button" className="btn ghost" onClick={reset}>
                    Lock another
                  </button>
                  <a className="btn" href={`/verify/${result.predictionId}`}>
                    View receipt →
                  </a>
                </div>
              </div>
            </div>
            {tweetState.kind !== 'idle' && (
              <TweetStatusCard
                state={tweetState}
                onRetry={() => postTweet(result.predictionId, result.unlockAtMs)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface TweetState {
  kind:
    | 'idle'
    | 'posting'
    | 'posted'
    | 'scope_missing'
    | 'credits_depleted'
    | 'failed';
}

function TweetStatusCard({
  state,
  onRetry,
}: {
  state:
    | { kind: 'idle' }
    | { kind: 'posting' }
    | { kind: 'posted'; url: string }
    | { kind: 'scope_missing' }
    | { kind: 'credits_depleted' }
    | { kind: 'failed'; detail: string };
  onRetry: () => void;
}) {
  // LK-02: separate subcard below the receipt, yellow palette (not red), with
  // its own retry CTA on the failed paths. Failures should never look like a
  // seal failure — the seal already succeeded.
  const isFailure =
    state.kind === 'failed' ||
    state.kind === 'scope_missing' ||
    state.kind === 'credits_depleted';
  const borderColor = isFailure
    ? 'var(--sealed)'
    : state.kind === 'posted'
      ? 'var(--verified)'
      : 'var(--border)';
  const bg = isFailure
    ? 'var(--sealed-soft)'
    : state.kind === 'posted'
      ? 'var(--verified-soft)'
      : 'var(--paper-2)';

  return (
    <div
      className="mt-12"
      style={{
        border: `1px solid ${borderColor}`,
        background: bg,
        borderRadius: 4,
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: 'var(--font-mono), monospace',
        fontSize: 12.5,
      }}
    >
      <span
        className="eyebrow"
        style={{ color: isFailure ? 'oklch(0.4 0.12 70)' : 'var(--muted)' }}
      >
        Auto-tweet
      </span>
      <div style={{ color: 'var(--ink-2)', lineHeight: 1.55 }}>
        {state.kind === 'posting' && <span>● Posting your tweet…</span>}
        {state.kind === 'posted' && (
          <span style={{ color: 'oklch(0.3 0.12 150)' }}>
            ✓ Tweeted ·{' '}
            <a
              href={state.url}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'underline' }}
            >
              view on X →
            </a>
          </span>
        )}
        {state.kind === 'scope_missing' && (
          <span>
            Auto-tweet needs posting permission. Sign out + sign back in with X
            to grant it. The seal itself is fine on Sui.
          </span>
        )}
        {state.kind === 'credits_depleted' && (
          <span>
            Auto-tweet is on standby — our X dev account is out of monthly
            write credits. Your prediction is locked on Sui either way; you can
            copy the verify URL and tweet it yourself.
          </span>
        )}
        {state.kind === 'failed' && (
          <span>Auto-tweet failed: {state.detail}. The seal itself is fine on Sui.</span>
        )}
      </div>
      {state.kind === 'failed' && (
        <button
          type="button"
          className="btn ghost"
          onClick={onRetry}
          style={{ alignSelf: 'flex-start', fontSize: 11 }}
        >
          Retry tweet
        </button>
      )}
    </div>
  );
}

function ReadinessGate({
  account,
  session,
  knownBinding,
  onStartOAuth,
}: {
  account: ReturnType<typeof useCurrentAccount>;
  session: ReturnType<typeof useXSession>['session'];
  knownBinding: ReturnType<typeof useXSession>['knownBinding'];
  onStartOAuth: () => void;
}) {
  const walletReady = !!account;
  const xReady = !!session;
  const allReady = walletReady && xReady;

  if (allReady) {
    return (
      <div className="readiness-pill mono">
        <span>✓ Wallet + X · ready to lock</span>
        <span style={{ color: 'var(--muted)' }}>
          · <strong style={{ color: 'inherit' }}>@{session.xHandle}</strong>
        </span>
      </div>
    );
  }

  // Show a one-step variant when wallet is the only remaining gate, and the
  // standard two-step card when X also needs sign-in.
  const stepsRemaining = (walletReady ? 0 : 1) + (xReady ? 0 : 1);
  return (
    <div className="readiness-card">
      <div className="readiness-head">
        <span className="eyebrow">
          {stepsRemaining === 1 ? 'One step left' : 'Two-step setup'}
        </span>
        <h2 className="section" style={{ fontSize: 22, margin: 0 }}>
          {stepsRemaining === 1
            ? 'Almost there — finish signing in.'
            : 'Get ready in 30 seconds'}
        </h2>
      </div>
      <ol className="readiness-steps">
        <ReadinessStep
          n={1}
          label="Connect a Sui wallet"
          done={walletReady}
          action={
            !walletReady ? (
              <span className="hint" style={{ maxWidth: 220 }}>
                Use the <strong>Connect</strong> button at the top right of the
                page.
              </span>
            ) : undefined
          }
        />
        <ReadinessStep
          n={2}
          label="Sign in with X"
          done={xReady}
          sub={
            knownBinding
              ? `This wallet was last signed in as @${knownBinding.xHandle}.`
              : undefined
          }
          action={
            !xReady && walletReady ? (
              <button type="button" onClick={onStartOAuth} className="btn">
                𝕏 {knownBinding ? `Sign in as @${knownBinding.xHandle}` : 'Sign in with X'}
              </button>
            ) : undefined
          }
        />
      </ol>
    </div>
  );
}

function ReadinessStep({
  n,
  label,
  done,
  sub,
  action,
}: {
  n: number;
  label: string;
  done: boolean;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <li className={`readiness-step${done ? ' done' : ''}`}>
      <span className="readiness-num">{done ? '✓' : String(n).padStart(2, '0')}</span>
      <div className="col" style={{ gap: 4 }}>
        <span className="readiness-label">{label}</span>
        {sub && <span className="hint">{sub}</span>}
      </div>
      {action && <div className="readiness-action">{action}</div>}
    </li>
  );
}

function ThinPipeline({ stepIdx, done }: { stepIdx: number; done: boolean }) {
  // 4px tall amber fill — single label tracks the active step. Replaces the
  // prior 5-tile grid + hex animation per UX_FIXES LK-04.
  const total = STEP_LABELS.length;
  const completed = done ? total : Math.max(0, stepIdx);
  const pct = Math.min(100, Math.round((completed / total) * 100));
  const activeLabel = done
    ? 'Locked'
    : STEP_LABELS[Math.max(0, Math.min(stepIdx, total - 1))]?.label ?? 'Locking…';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          height: 4,
          width: '100%',
          background: 'var(--paper-2)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'var(--sealed)',
            transition: 'width 0.25s ease-out',
          }}
        />
      </div>
      <span
        className="mono"
        style={{ fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.04em' }}
      >
        {activeLabel}
        {!done && ' · ' + (completed + 1) + '/' + total}
      </span>
    </div>
  );
}

function TweetPreview({
  text,
  handle,
  unlockIso,
  autoTweet,
}: {
  text: string;
  handle: string;
  unlockIso: string;
  autoTweet: boolean;
}) {
  const unlockDate = unlockIso ? new Date(unlockIso) : null;
  const unlockStr = unlockDate ? unlockDate.toISOString().slice(0, 10) : '—';
  const [sealedTime, setSealedTime] = useState<string>('—');
  useEffect(() => {
    setSealedTime(fmtAbs(Date.now()).slice(0, 16));
  }, []);

  // LK-11: toggle between the lock-tweet (now) and the projected reveal-tweet
  // (after unlock). Helps the user visualise both ends of the receipt arc.
  const [showReveal, setShowReveal] = useState(false);
  const lockText =
    `Locked a prediction at ${sealedTime} UTC. Opens on ${unlockStr}.\n\n` +
    `Proof: toldproof.xyz/verify/0x7f3a8c2e…`;
  const revealText =
    `Opened my locked prediction from ${sealedTime} UTC.\n\n` +
    `Nobody could read it until now — and AI judge has the verdict here:\n\n` +
    `toldproof.xyz/verify/0x7f3a8c2e…`;
  const tweetText = showReveal ? revealText : lockText;

  const displayHandle = handle || 'yourname';
  const cipherPreview = fakeHexBlock(text || 'x', 22)
    .match(/.{1,2}/g)!
    .join(' ');

  return (
    <div
      style={{
        position: 'sticky',
        top: 80,
        display: 'grid',
        gap: 12,
        minWidth: 0,
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="eyebrow">Tweet preview</span>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <div className="row" style={{ gap: 0 }}>
            <button
              type="button"
              onClick={() => setShowReveal(false)}
              className={`filter-tab${!showReveal ? ' active' : ''}`}
              style={{ fontSize: 10 }}
            >
              See it now
            </button>
            <button
              type="button"
              onClick={() => setShowReveal(true)}
              className={`filter-tab${showReveal ? ' active' : ''}`}
              style={{ fontSize: 10 }}
            >
              See the reveal
            </button>
          </div>
          <span
            className="mono"
            style={{
              fontSize: 10,
              color: autoTweet ? 'var(--verified)' : 'var(--muted)',
            }}
          >
            {autoTweet ? '● will post' : '○ won’t post'}
          </span>
        </div>
      </div>
      <div
        className="tweet"
        style={{ opacity: autoTweet ? 1 : 0.55, transition: 'opacity 0.15s' }}
      >
        <div className="avatar">{displayHandle.slice(0, 1).toUpperCase()}</div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="tweet-head">
            <span className="name">{displayHandle}</span>
            <span className="handle">@{displayHandle}</span>
            <span className="time">· now</span>
          </div>
          <div className="tweet-body" style={{ whiteSpace: 'pre-wrap' }}>
            {tweetText.split(/(toldproof\.xyz\/[^\s]+)/g).map((part, i) =>
              /^toldproof\.xyz/.test(part) ? (
                <span key={i} className="l">
                  {part}
                </span>
              ) : (
                part
              ),
            )}
          </div>
          <div
            className="mt-12"
            style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '12px 14px',
              background: 'var(--paper-2)',
              display: 'grid',
              gap: 8,
            }}
          >
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                }}
              >
                toldproof.xyz
              </span>
              <PixelMark bitmap={BRAND_MARK} size={14} color="var(--ink)" />
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.4, color: 'var(--ink)', fontWeight: 600 }}>
              Locked prediction · opens {unlockStr}
            </div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                letterSpacing: '0.04em',
                filter: 'blur(0.5px)',
                wordBreak: 'break-all',
              }}
            >
              {cipherPreview}
            </div>
            <div
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: '0.1em',
                color: 'var(--muted)',
                textTransform: 'uppercase',
              }}
            >
              locked · sui · walrus · seal
            </div>
          </div>
        </div>
      </div>
      <span
        className="mono"
        style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.55 }}
      >
        ↑ This is the exact tweet that goes out from @{displayHandle} the moment
        we save your prediction. The actual text stays hidden until {unlockStr}.
      </span>
    </div>
  );
}
