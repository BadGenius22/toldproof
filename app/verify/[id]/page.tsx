// Verification page — stub for Day 3. Day 4 adds full Walrus/Seal links + reveal status polling.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

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

  const sealedAt = new Date(Number(p.sealed_at_ms));
  const unlockAt = new Date(Number(p.unlock_at_ms));
  const blobId = utf8(p.blob_id);
  const explorerUrl = `https://${NETWORK}.suivision.xyz/object/${id}`;
  const walrusUrl = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`;

  return (
    <section className="flex flex-1 w-full max-w-3xl flex-col gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
          Verification
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          {p.revealed ? 'Revealed' : 'Sealed'} prediction
        </h1>
      </div>

      {p.revealed && (
        <div className="rounded-md border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
          <p className="text-xs font-medium uppercase text-green-700 dark:text-green-300">
            On-chain plaintext
          </p>
          <p className="mt-1 font-mono text-base text-green-900 dark:text-green-100">
            {utf8(p.revealed_plaintext)}
          </p>
        </div>
      )}

      <dl className="grid gap-3 rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <Row k="Prediction ID" v={id} mono />
        <Row k="Publisher" v={p.publisher} mono />
        <Row k="X handle" v={`@${p.x_handle}`} />
        <Row k="Sealed at" v={`${sealedAt.toISOString()} (${p.sealed_at_ms} ms)`} />
        <Row k="Unlock at" v={`${unlockAt.toISOString()} (${p.unlock_at_ms} ms)`} />
        <Row k="Status" v={p.revealed ? `Revealed at ${new Date(Number(p.revealed_at_ms)).toISOString()}` : 'Sealed — not yet unlocked'} />
        <Row k="Content hash (SHA-256)" v={hex(p.content_hash)} mono />
        <Row k="Walrus blob ID" v={blobId} mono />
      </dl>

      <div className="flex gap-3">
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:border-black dark:border-neutral-700 dark:hover:border-white"
        >
          View on Sui Explorer →
        </a>
        <a
          href={walrusUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:border-black dark:border-neutral-700 dark:hover:border-white"
        >
          Walrus ciphertext →
        </a>
        <Link
          href="/seal"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:border-black dark:border-neutral-700 dark:hover:border-white"
        >
          Seal yours
        </Link>
      </div>
    </section>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-1 md:grid-cols-[200px_1fr]">
      <dt className="text-neutral-500">{k}</dt>
      <dd className={`break-all ${mono ? 'font-mono text-xs' : ''}`}>{v}</dd>
    </div>
  );
}
