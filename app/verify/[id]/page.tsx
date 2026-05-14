// Verification page — the product's centerpiece. Reads the SealedPrediction
// Move object directly from a Sui fullnode and renders the receipt.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import {
  Chip,
  HexDump,
  PageEyebrow,
  Perforation,
  PixelMark,
  ReceiptRow,
  StatusChip,
  BIG_SEAL,
  BRAND_MARK,
  fakeHexBlock,
  fmtAbs,
  fmtRel,
  shortHash,
} from '../../../components/design';
import { VerifyLiveCountdown } from './live';

const RPC_URL = process.env.NEXT_PUBLIC_SUI_RPC ?? 'https://fullnode.testnet.sui.io:443';
const NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? 'testnet') as
  | 'testnet'
  | 'mainnet'
  | 'devnet'
  | 'localnet';

interface Fields {
  publisher: string;
  x_handle: string;
  sealed_at_ms: string;
  unlock_at_ms: string;
  content_hash: number[] | string;
  blob_id: number[] | string;
  sealed_key: number[] | string;
  revealed: boolean;
  revealed_at_ms: string;
  revealed_plaintext: number[] | string;
}

function decodeBytesField(v: number[] | string): Uint8Array {
  if (Array.isArray(v)) return new Uint8Array(v);
  const binary = atob(v);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}
const utf8 = (v: number[] | string) => new TextDecoder().decode(decodeBytesField(v));
const hex = (v: number[] | string) =>
  Array.from(decodeBytesField(v))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

async function fetchPrediction(id: string): Promise<Fields | null> {
  const client = new SuiJsonRpcClient({ url: RPC_URL, network: NETWORK });
  try {
    const res = await client.getObject({ id, options: { showContent: true } });
    const content = res.data?.content;
    if (!content || content.dataType !== 'moveObject') return null;
    return content.fields as unknown as Fields;
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
          <Link href={`/${p.x_handle}`} className="btn ghost">
            ← @{p.x_handle}&apos;s profile
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
                <Chip status={status === 'unlocked' ? 'warn' : 'sealed'}>
                  {status === 'unlocked' ? (
                    <>Date reached · waiting to be posted</>
                  ) : (
                    <>
                      Opens in <VerifyLiveCountdown unlockAtMs={unlockAtMs} />
                    </>
                  )}
                </Chip>
              </div>
              <HexDump hex={cipherDump} rows={6} highlightFirst={0} />
            </div>
          </div>
        )}

        {/* The receipt */}
        <div className="mt-24">
          <div className="receipt receipt-settle">
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
              <dl style={{ margin: 0 }}>
                <ReceiptRow k="Prediction ID" v={id} />
                <ReceiptRow k="Locked by (wallet)" v={p.publisher} />
                <ReceiptRow k="X handle" v={<span>@{p.x_handle}</span>} />
                <ReceiptRow
                  k="Locked at"
                  v={`${fmtAbs(sealedAtMs)} (${sealedAgo})`}
                />
                <ReceiptRow k="Opens on" v={fmtAbs(unlockAtMs)} />
                {revealed ? (
                  <ReceiptRow k="Opened at" v={fmtAbs(revealedAtMs)} />
                ) : (
                  <ReceiptRow
                    k="Time until open"
                    v={
                      <span
                        style={{
                          color: status === 'unlocked' ? 'var(--warn)' : 'var(--sealed)',
                        }}
                      >
                        <VerifyLiveCountdown unlockAtMs={unlockAtMs} />
                      </span>
                    }
                  />
                )}
                <ReceiptRow k="Status" v={<StatusChip p={view} />} />
                <ReceiptRow k="Text fingerprint" v={contentHashHex} />
                <ReceiptRow k="Walrus storage ID" v={blobId} />
                <ReceiptRow k="Locked key (preview)" v={sealedKeyPreview} />
                <ReceiptRow
                  k="Network"
                  v={`sui:${NETWORK} · walrus:testnet · seal:testnet`}
                />
              </dl>
            </div>

            <Perforation />

            <div
              className="receipt-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div className="row" style={{ alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
                <SealMark idShort={idShort} />
                <div className="col" style={{ gap: 6, flex: 1, minWidth: 240 }}>
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
              </div>
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
                >
                  See on Sui ↗
                </a>
                <a className="btn ghost" target="_blank" rel="noreferrer" href={walrusUrl}>
                  See on Walrus ↗
                </a>
              </div>
              <Link href="/seal" className="btn">
                Lock yours →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SealMark({ idShort }: { idShort: string }) {
  return (
    <div
      style={{
        border: '2px solid var(--ink)',
        padding: 14,
        background: 'var(--paper)',
        borderRadius: 4,
        display: 'grid',
        gap: 8,
        placeItems: 'center',
        minWidth: 132,
        boxShadow: '3px 3px 0 var(--ink)',
        transform: 'rotate(-3deg)',
      }}
    >
      <PixelMark bitmap={BIG_SEAL} size={86} color="var(--ink)" />
      <div
        className="mono"
        style={{
          fontSize: 9,
          color: 'var(--ink)',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          textAlign: 'center',
          borderTop: '1px dashed var(--ink)',
          paddingTop: 6,
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
