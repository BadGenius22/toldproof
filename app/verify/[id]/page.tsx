// Verification page — the product's centerpiece. Reads the SealedPrediction
// Move object directly from a Sui fullnode and renders the receipt.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import {
  Chip,
  EntityBadge,
  HexDump,
  PageEyebrow,
  Perforation,
  PixelMark,
  ReceiptRow,
  ShareButton,
  StatusChip,
  BIG_SEAL,
  BRAND_MARK,
  SUI_MARK,
  WALRUS_MARK,
  fakeHexBlock,
  fmtAbs,
  fmtRel,
  shortHash,
} from '../../../components/design';
import {
  SealedPredictionFieldsSchema,
  type BytesField,
} from '../../../lib/schemas';
import type { SealedPredictionFields } from '../../../lib/sui';
import { VerifyLiveCountdown } from './live';
import { RevealButton } from './reveal-button';
import { ResolveButton } from './resolve-button';
import { ReasoningTrace, type Trace } from './reasoning-trace';

const RPC_URL = process.env.NEXT_PUBLIC_SUI_RPC ?? 'https://fullnode.testnet.sui.io:443';
const NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? 'testnet') as
  | 'testnet'
  | 'mainnet'
  | 'devnet'
  | 'localnet';

// Always re-fetch on each request so router.refresh() after a manual reveal
// actually re-runs fetchPrediction and surfaces the new revealed:true state.
// Without this, Next.js can serve a cached segment showing the pre-reveal data.
export const dynamic = 'force-dynamic';

function decodeBytesField(v: BytesField): Uint8Array {
  if (Array.isArray(v)) return new Uint8Array(v);
  const binary = atob(v);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}
const utf8 = (v: BytesField) => new TextDecoder().decode(decodeBytesField(v));
const hex = (v: BytesField) =>
  Array.from(decodeBytesField(v))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

async function fetchPrediction(id: string): Promise<SealedPredictionFields | null> {
  const client = new SuiJsonRpcClient({ url: RPC_URL, network: NETWORK });
  try {
    const res = await client.getObject({ id, options: { showContent: true } });
    const content = res.data?.content;
    if (!content || content.dataType !== 'moveObject') return null;
    const parsed = SealedPredictionFieldsSchema.safeParse(content.fields);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// Fetch the AI reasoning trace JSON from Walrus. Best-effort — if the
// aggregator is down or the JSON is malformed, we return null and the page
// falls back to NOT rendering the inline trace component (the raw-link
// footer stays visible inside it, but the section is hidden entirely).
async function fetchReasoningTrace(blobId: string): Promise<Trace | null> {
  if (!blobId) return null;
  try {
    const url = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as Trace;
    if (!data || typeof data !== 'object' || !data.verdict) return null;
    return data;
  } catch {
    return null;
  }
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await fetchPrediction(id);
  if (!p) notFound();
  // Fetch the AI reasoning trace from Walrus in parallel with the rest of
  // the page render. The trace contains the difficulty rating + per-step
  // tool calls used by <ReasoningTrace>.
  const reasoningBlobIdForTrace = p.reasoning_blob_id
    ? new TextDecoder().decode(decodeBytesField(p.reasoning_blob_id))
    : '';
  const trace = p.resolved
    ? await fetchReasoningTrace(reasoningBlobIdForTrace)
    : null;
  const difficulty = trace?.verdict.difficulty;
  const difficultyReasoning = trace?.verdict.difficultyReasoning;

  const sealedAtMs = Number(p.sealed_at_ms);
  const unlockAtMs = Number(p.unlock_at_ms);
  const revealedAtMs = Number(p.revealed_at_ms);
  const blobId = utf8(p.blob_id);
  const contentHashHex = hex(p.content_hash);
  const sealedKeyBytes = decodeBytesField(p.sealed_key);
  const sealedKeyPreview =
    Array.from(sealedKeyBytes.slice(0, 6))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('') + '…';
  const revealed = p.revealed;
  const revealedText = revealed ? utf8(p.revealed_plaintext) : '';
  const isAgent = p.entity_type === 1;
  // Inline prefix in front of the identity in copy ("@dewaxindo's profile",
  // "@dewaxindo (Human)"). Agents don't follow the X "@" convention — their
  // alias IS the name — so emit no prefix. EntityBadge handles the visual
  // AGENT/HUMAN signal elsewhere.
  const identityPrefix = isAgent ? '' : '@';
  const identityLabel = isAgent ? 'Agent alias' : 'X handle';
  const resolved = p.resolved === true;
  const hit = p.hit === true;
  const resolvedAtMs = Number(p.resolved_at_ms ?? '0');
  const reasoningBlobId = p.reasoning_blob_id ? utf8(p.reasoning_blob_id) : '';
  const resolverAddr = p.resolver ?? '';
  const reasoningUrl = reasoningBlobId
    ? `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${reasoningBlobId}`
    : '';

  const status: 'sealed' | 'unlocked' | 'revealed' = revealed
    ? 'revealed'
    : Date.now() >= unlockAtMs
      ? 'unlocked'
      : 'sealed';

  const view = { unlockAtMs, revealed };

  const sealedAgo = fmtRel(sealedAtMs);
  const cipherDump = fakeHexBlock('cipher:' + id, 96);
  const idShort = shortHash(id, 8, 6);

  const explorerUrl = `https://${NETWORK}.suivision.xyz/object/${id}`;
  const walrusUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`;

  return (
    <div className="page">
      <div className="container narrow">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <PageEyebrow>Verification</PageEyebrow>
          <Link href={`/${p.identity}`} className="btn ghost">
            ← {identityPrefix}{p.identity}&apos;s profile
          </Link>
        </div>

        <h1 className="display" style={{ fontSize: 'clamp(34px, 5vw, 56px)', marginTop: 12 }}>
          {status === 'revealed' ? 'Open.' : status === 'unlocked' ? 'Ready to open.' : 'Locked.'}
        </h1>

        {/* Revealed plaintext block */}
        {revealed && (
          <div
            className="mt-24"
            style={{
              border: '1px solid var(--verified)',
              background: 'var(--verified-soft)',
              borderRadius: 4,
              padding: '20px 22px',
            }}
          >
            <div
              className="row"
              style={{ justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'oklch(0.35 0.12 150)',
                }}
              >
                The prediction · opened {fmtRel(revealedAtMs)}
              </span>
              <Chip status="verified">Fingerprint matches ✓</Chip>
            </div>
            <p
              className="mono"
              style={{
                margin: 0,
                fontSize: 18,
                lineHeight: 1.4,
                color: 'oklch(0.3 0.12 150)',
              }}
            >
              &quot;{revealedText}&quot;
            </p>
          </div>
        )}

        {/* Resolution Agent verdict */}
        {revealed && (
          <div className="mt-24">
            {resolved ? (
              <div
                style={{
                  border: '1px solid var(--ink)',
                  borderRadius: 4,
                  background: 'var(--paper)',
                  padding: '20px 22px',
                }}
              >
                <div
                  className="row"
                  style={{
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <span className="eyebrow">
                    The AI&apos;s call · {fmtRel(resolvedAtMs)}
                  </span>
                </div>
                {/* Trace first (P0-5) — the trace IS the defensible IP, so it
                    takes the attention before the headline pills. */}
                {trace ? (
                  <ReasoningTrace trace={trace} rawWalrusUrl={reasoningUrl} />
                ) : reasoningUrl ? (
                  <a
                    className="btn ghost"
                    target="_blank"
                    rel="noreferrer"
                    href={reasoningUrl}
                  >
                    ↗ Open the raw record on Walrus
                  </a>
                ) : null}
                <div
                  className="row mt-16"
                  style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
                >
                  <Chip status={hit ? 'verified' : 'warn'}>
                    {hit ? '✓ Hit · they called it' : '✗ Miss · they didn’t'}
                  </Chip>
                  {difficulty && (
                    <DifficultyPill
                      level={difficulty}
                      reasoning={difficultyReasoning}
                    />
                  )}
                </div>
                <p
                  className="mt-12"
                  style={{
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: 'var(--ink-2)',
                  }}
                >
                  The AI read the prediction, checked the facts, and made
                  a call. Every step of its reasoning is saved on Walrus so
                  anyone can review exactly how it decided.
                </p>
                <div
                  className="mt-12"
                  style={{ fontSize: 11, color: 'var(--muted)' }}
                >
                  <span className="mono">
                    Signed by AI judge {shortHash(resolverAddr, 6, 4)}
                  </span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  border: '1px dashed var(--border)',
                  borderRadius: 4,
                  padding: '14px 16px',
                  background: 'var(--paper-2)',
                  fontFamily: 'var(--font-mono), monospace',
                  fontSize: 12,
                  color: 'var(--muted)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <span>AI judge hasn&apos;t reached this one yet — trigger now or wait.</span>
                <ResolveButton id={id} />
              </div>
            )}
          </div>
        )}

        {/* Sealed payload */}
        {!revealed && (
          <div className="mt-24">
            <div
              style={{
                border: '1px solid var(--ink)',
                borderRadius: 4,
                padding: '18px 20px',
                background: 'var(--paper)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                className="row"
                style={{ justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}
              >
                <span className="eyebrow">Scrambled text on Walrus · {blobId.slice(0, 22)}…</span>
                {status === 'unlocked' ? (
                  <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Chip status="warn">Date reached · waiting to be posted</Chip>
                    <RevealButton id={id} />
                  </div>
                ) : (
                  <Chip status="sealed">
                    Opens in <VerifyLiveCountdown unlockAtMs={unlockAtMs} />
                  </Chip>
                )}
              </div>
              <HexDump hex={cipherDump} rows={6} highlightFirst={0} />
            </div>
          </div>
        )}

        {/* The receipt */}
        <div className="mt-24">
          <div className="receipt receipt-settle" style={{ position: 'relative' }}>
            <SealMark idShort={idShort} variant="corner" />
            <div className="receipt-header">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <PixelMark bitmap={BRAND_MARK} size={14} color="var(--paper)" />
                TOLDPROOF · receipt · v0.1
              </span>
              <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, opacity: 0.7 }}>
                #{idShort}
              </span>
            </div>
            <div className="receipt-body">
              {/* Default 6 rows (VF-04) — the human-readable summary. */}
              <dl style={{ margin: 0 }}>
                <ReceiptRow
                  k={identityLabel}
                  v={
                    <span>
                      {identityPrefix}{p.identity}{isAgent ? ' (AI agent)' : ''}
                    </span>
                  }
                />
                <ReceiptRow
                  k="Locked at"
                  v={`${fmtAbs(sealedAtMs)} (${sealedAgo})`}
                />
                {revealed ? (
                  <ReceiptRow k="Opened at" v={fmtAbs(revealedAtMs)} />
                ) : (
                  <ReceiptRow
                    k="Opens on"
                    v={
                      <span
                        style={{
                          color: status === 'unlocked' ? 'var(--warn)' : 'var(--sealed)',
                        }}
                      >
                        {fmtAbs(unlockAtMs)} · <VerifyLiveCountdown unlockAtMs={unlockAtMs} />
                      </span>
                    }
                  />
                )}
                <ReceiptRow k="Status" v={<StatusChip p={view} />} />
                {resolved && (
                  <>
                    <ReceiptRow
                      k="AI verdict"
                      v={
                        <span
                          style={{
                            color: hit ? 'var(--verified)' : 'var(--warn)',
                            fontWeight: 600,
                          }}
                        >
                          {hit ? 'HIT' : 'MISS'} · {fmtAbs(resolvedAtMs)}
                        </span>
                      }
                    />
                  </>
                )}
              </dl>

              <details
                className="receipt-tech"
                style={{
                  marginTop: 14,
                  borderTop: '1px dashed var(--border)',
                  paddingTop: 12,
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    fontSize: 11,
                    color: 'var(--muted)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontFamily: 'var(--font-mono), monospace',
                    listStyle: 'none',
                  }}
                >
                  Show technical details ↓
                </summary>
                <dl style={{ margin: '12px 0 0' }}>
                  <ReceiptRow k="Prediction ID" v={id} />
                  <ReceiptRow k="Locked by (wallet)" v={p.publisher} />
                  <ReceiptRow
                    k="Entity type"
                    v={
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <EntityBadge entityType={isAgent ? 1 : 0} variant="sm" />
                        {isAgent ? 'AI agent' : 'Human'}
                      </span>
                    }
                  />
                  {resolved && (
                    <ReceiptRow k="Reasoning (Walrus)" v={reasoningBlobId} />
                  )}
                  <ReceiptRow k="Text fingerprint" v={contentHashHex} />
                  <ReceiptRow k="Walrus storage ID" v={blobId} />
                  <ReceiptRow k="Locked key (preview)" v={sealedKeyPreview} />
                  <ReceiptRow
                    k="Network"
                    v={`sui:${NETWORK} · walrus:testnet · seal:testnet`}
                  />
                </dl>
              </details>
            </div>

            <Perforation />

            <div
              className="receipt-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              <span className="eyebrow">How this proof works</span>
              <p
                className="mono"
                style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}
              >
                This receipt comes from a record on Sui at{' '}
                <span style={{ color: 'var(--ink)' }}>{idShort}</span>. The scrambled text
                sits on Walrus, and the key stays locked until{' '}
                <span style={{ color: 'var(--sealed)' }}>{fmtAbs(unlockAtMs)}</span>.
                Nothing can be edited after this is locked.
              </p>
            </div>

            <Perforation />

            <div
              className="receipt-body row"
              style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}
            >
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <a
                  className="btn ghost"
                  target="_blank"
                  rel="noreferrer"
                  href={explorerUrl}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <PixelMark bitmap={SUI_MARK} size={12} color="currentColor" />
                  See on Sui ↗
                </a>
                <a
                  className="btn ghost"
                  target="_blank"
                  rel="noreferrer"
                  href={walrusUrl}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <PixelMark bitmap={WALRUS_MARK} size={12} color="currentColor" />
                  See on Walrus ↗
                </a>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <ShareButton
                  text={composeShareText(p, revealed, hit, resolved, unlockAtMs)}
                  url={`https://toldproof.xyz/verify/${id}`}
                  variant="primary"
                  label={
                    revealed && resolved
                      ? 'Tweet the verdict'
                      : revealed
                        ? 'Tweet the open'
                        : 'Tweet the lock'
                  }
                />
                <Link href="/lock" className="btn ghost">
                  Lock yours →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function composeShareText(
  p: SealedPredictionFields,
  revealed: boolean,
  hit: boolean,
  resolved: boolean,
  unlockAtMs: number,
): string {
  // TODO(ux-followup): agents render `@alias` here — the UX spec treats all
  // identities as X handles. Revisit when agent share copy is specced.
  const handle = `@${p.identity}`;
  if (revealed && resolved) {
    return hit
      ? `${handle} locked this in advance. AI judge: HIT ✓\n\nRead every step:`
      : `${handle} locked this in advance. AI judge: MISS ✗\n\nRead every step:`;
  }
  if (revealed) {
    return `${handle} just opened a locked prediction. AI judge is reading it now.\n\nFollow along:`;
  }
  const opensOn = new Date(unlockAtMs).toISOString().slice(0, 10);
  return `${handle} locked a prediction. Opens ${opensOn}. Nobody can read it until then — including ${handle}.\n\nReceipt:`;
}

function DifficultyPill({
  level,
  reasoning,
}: {
  level: 'trivial' | 'easy' | 'medium' | 'hard';
  reasoning?: string;
}) {
  // Plain-English label + visual treatment per difficulty level. Trivial
  // gets the warning palette to signal "honest reader judgment required" —
  // it doesn't downgrade hit/miss, just flags the call as already-true.
  const labels: Record<typeof level, string> = {
    trivial: 'Already true when locked',
    easy: 'Likely outcome',
    medium: 'Real call',
    hard: 'Bold call ★',
  };
  const styleByLevel: Record<typeof level, { bg: string; fg: string; border: string }> = {
    trivial: {
      bg: 'var(--warn-soft, #fff7e6)',
      fg: 'var(--ink)',
      border: 'var(--warn)',
    },
    easy: {
      bg: 'var(--paper-2)',
      fg: 'var(--ink-2)',
      border: 'var(--border)',
    },
    medium: {
      bg: 'var(--paper-2)',
      fg: 'var(--ink)',
      border: 'var(--border)',
    },
    hard: {
      bg: 'var(--verified-soft, #eaffea)',
      fg: 'oklch(0.3 0.12 150)',
      border: 'var(--verified)',
    },
  };
  const s = styleByLevel[level];
  return (
    <span
      title={reasoning ?? ''}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontFamily: 'var(--font-mono), monospace',
        letterSpacing: '0.04em',
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {labels[level]}
    </span>
  );
}

function SealMark({
  idShort,
  variant = 'inline',
}: {
  idShort: string;
  variant?: 'inline' | 'corner';
}) {
  // VF-06: 'corner' variant pins absolute to the top-right of the receipt,
  // overlaps by ~30%, rotates -7deg, and uses a scuffed clip-path mask so
  // it reads as a stamp pressed onto the paper.
  const isCorner = variant === 'corner';
  return (
    <div
      className={isCorner ? 'seal-mark seal-mark-corner' : 'seal-mark'}
      style={{
        border: '2px solid var(--ink)',
        padding: isCorner ? 10 : 14,
        background: 'var(--paper)',
        borderRadius: 4,
        display: 'grid',
        gap: 6,
        placeItems: 'center',
        minWidth: isCorner ? 96 : 132,
        boxShadow: '3px 3px 0 var(--ink)',
        transform: isCorner ? 'rotate(-7deg)' : 'rotate(-3deg)',
        ...(isCorner
          ? {
              position: 'absolute' as const,
              top: -28,
              right: 24,
              zIndex: 3,
              clipPath:
                'polygon(2% 4%, 8% 0%, 30% 3%, 55% 0%, 80% 4%, 98% 0%, 100% 30%, 96% 55%, 100% 80%, 95% 100%, 70% 96%, 40% 100%, 12% 96%, 0% 90%, 4% 60%, 0% 30%)',
            }
          : {}),
      }}
    >
      <PixelMark
        bitmap={BIG_SEAL}
        size={isCorner ? 60 : 86}
        color="var(--ink)"
      />
      <div
        className="mono"
        style={{
          fontSize: isCorner ? 8 : 9,
          color: 'var(--ink)',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          textAlign: 'center',
          borderTop: '1px dashed var(--ink)',
          paddingTop: 4,
          width: '100%',
        }}
      >
        locked
        <br />
        <span style={{ color: 'var(--muted)' }}>{idShort}</span>
      </div>
    </div>
  );
}
