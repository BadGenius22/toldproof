'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  Chip,
  HexDump,
  PageEyebrow,
  Perforation,
  PixelMark,
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
  const router = useRouter();
  const [suiClient] = useState(
    () => new SuiJsonRpcClient({ url: RPC_URL, network: NETWORK }),
  );

  const [text, setText] = useState('');
  const [unlockIso, setUnlockIso] = useState('');
  useEffect(() => {
    setUnlockIso((prev) => prev || defaultUnlockLocal());
  }, []);
  const [xHandle, setXHandle] = useState('');
  const [autoTweet, setAutoTweet] = useState(true);

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

  const running = step !== 'idle' && step !== 'done' && step !== 'error';
  const disabled = running;
  const charsLeft = 280 - text.length;
  const stepIdx = stepIndexOf(step);

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
      setTimeout(() => router.push(`/verify/${created.objectId}`), 2200);
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
  }

  return (
    <div className="page">
      <div className="container">
        <PageEyebrow>Lock a prediction</PageEyebrow>
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

        <form onSubmit={handleSubmit} className="mt-32 seal-layout">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 18,
              minWidth: 0,
            }}
          >
            <div className="field">
              <label htmlFor="pred">Your prediction</label>
              <textarea
                id="pred"
                className="textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={280}
                disabled={disabled || !!result}
                required
                placeholder="BTC > 95k by 2026-06-30"
              />
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="hint">280 letters max — same as X.</span>
                <span className="hint">{charsLeft} left</span>
              </div>
            </div>

            <div className="seal-fields-2">
              <div className="field">
                <label htmlFor="handle">Your X handle</label>
                <input
                  id="handle"
                  className="input"
                  value={xHandle}
                  onChange={(e) => setXHandle(e.target.value.replace(/^@/, ''))}
                  disabled={disabled || !!result}
                  required
                  placeholder="elonmusk"
                />
                <span className="hint">We&apos;ll link your X account in a future update.</span>
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

            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {(
                [
                  { label: '+5 min', ms: 5 * 60_000 },
                  { label: '+1 hr', ms: 60 * 60_000 },
                  { label: '+1 day', ms: 24 * 60 * 60_000 },
                  { label: '+1 week', ms: 7 * 24 * 60 * 60_000 },
                  { label: '+1 month', ms: 30 * 24 * 60 * 60_000 },
                ] as const
              ).map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="btn ghost"
                  disabled={disabled || !!result}
                  onClick={() => {
                    const d = new Date(Date.now() + p.ms);
                    d.setSeconds(0);
                    d.setMilliseconds(0);
                    setUnlockIso(formatLocalDatetimeInput(d));
                  }}
                  style={{ padding: '6px 10px', fontSize: 10 }}
                >
                  {p.label}
                </button>
              ))}
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
                className="btn lg"
                disabled={disabled || !account}
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
              >
                {!account ? 'Connect wallet to lock' : '▮ Lock my prediction'}
              </button>
            )}
          </div>

          <TweetPreview
            text={text}
            handle={xHandle}
            unlockIso={unlockIso}
            autoTweet={autoTweet}
          />
        </form>

        {/* Pipeline */}
        {(running || result) && (
          <div
            className="mt-32"
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <PageEyebrow>{result ? 'Locked' : 'Locking…'}</PageEyebrow>
            <SealPipeline stepIdx={stepIdx} done={!!result} />
            {!result && running && <HexAnimation text={text} stepIdx={stepIdx} />}
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
                  <PixelMark bitmap={BRAND_MARK} size={14} color="var(--paper)" />
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
          </div>
        )}
      </div>
    </div>
  );
}

function SealPipeline({ stepIdx, done }: { stepIdx: number; done: boolean }) {
  return (
    <div className="steps">
      {STEP_LABELS.map((s, i) => {
        const state = done || i < stepIdx ? 'done' : i === stepIdx ? 'active' : '';
        return (
          <div key={s.id} className={`step-item ${state}`}>
            <span className="num">{String(i + 1).padStart(2, '0')}</span>
            <span>{s.label}</span>
            {state === 'active' && (
              <span style={{ marginLeft: 'auto' }} className="spinner" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function HexAnimation({ text, stepIdx }: { text: string; stepIdx: number }) {
  const totalBytes = 64;
  const plainHex = useMemo(() => {
    const enc = new TextEncoder().encode(text);
    let h = '';
    for (let i = 0; i < totalBytes; i += 1) {
      const b = enc[i] ?? (0x20 + (i % 90));
      h += b.toString(16).padStart(2, '0');
    }
    return h;
  }, [text]);
  const cipherHex = useMemo(() => fakeHexBlock('cipher:' + text, totalBytes), [text]);

  // stepIdx 0 = encrypting → still plaintext. After 0 → cipher.
  const display = stepIdx >= 1 ? cipherHex : plainHex;
  const detail =
    STEP_LABELS[Math.max(0, Math.min(stepIdx, STEP_LABELS.length - 1))]?.detail ?? '';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
      <div
        className="row"
        style={{
          gap: 12,
          fontFamily: 'var(--font-mono), monospace',
          fontSize: 11,
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        <span>{stepIdx <= 0 ? 'Your words' : 'Scrambled on Walrus'}</span>
        <span style={{ marginLeft: 'auto' }}>
          {stepIdx >= 1 ? 'unreadable until the open date' : 'still on your device'}
        </span>
      </div>
      <HexDump hex={display} rows={4} highlightFirst={stepIdx <= 0 ? totalBytes : 0} />
      <div
        className="hint mono"
        style={{ fontSize: 11, color: 'var(--muted)' }}
      >
        {detail}
      </div>
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

  const tweetText =
    `Locked a prediction at ${sealedTime} UTC. Opens on ${unlockStr}.\n\n` +
    `Proof: toldproof.xyz/verify/0x7f3a8c2e…`;

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
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Tweet preview</span>
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
