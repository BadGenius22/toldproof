'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CurrentAccountSigner,
  useCurrentAccount,
  useDAppKit,
} from '@mysten/dapp-kit-react';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { sealPredictionTx } from '../lib/sui';
import { aesGcmEncrypt, randomAesKey, sha256 } from '../lib/crypto';
import { storeBlob } from '../lib/walrus';
import { getSealClient, encryptAesKey } from '../lib/seal';
import { env } from '../lib/env';

type Step =
  | 'idle'
  | 'encrypting'
  | 'uploading'
  | 'sealing'
  | 'signing'
  | 'confirming'
  | 'done'
  | 'error';

const STEP_LABELS: Record<Step, string> = {
  idle: '',
  encrypting: 'Encrypting prediction locally...',
  uploading: 'Uploading ciphertext to Walrus...',
  sealing: 'Sealing AES key with time-lock...',
  signing: 'Awaiting wallet signature...',
  confirming: 'Confirming on Sui...',
  done: 'Done.',
  error: 'Failed.',
};

function defaultUnlockIso(): string {
  // 1 hour from now, formatted for datetime-local input (YYYY-MM-DDTHH:MM)
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0);
  d.setMilliseconds(0);
  return d.toISOString().slice(0, 16);
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
  // Lazy: create the JSON-RPC client once per mount, never at module top.
  // Using useState's lazy initializer keeps it stable across re-renders.
  const [suiClient] = useState(
    () => new SuiJsonRpcClient({ url: RPC_URL, network: NETWORK }),
  );

  const [text, setText] = useState('');
  const [unlockIso, setUnlockIso] = useState(defaultUnlockIso());
  const [xHandle, setXHandle] = useState('');

  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    predictionId: string;
    blobId: string;
    xHandle: string;
  } | null>(null);

  const disabled = step !== 'idle' && step !== 'done' && step !== 'error';
  const charsLeft = 280 - text.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!account) {
      setError('Connect a wallet first');
      setStep('error');
      return;
    }
    setError(null);
    setResult(null);

    try {
      const unlockMs = new Date(unlockIso).getTime();
      if (Number.isNaN(unlockMs) || unlockMs <= Date.now() + 30_000) {
        throw new Error('Unlock must be at least 30 seconds in the future');
      }
      const unlockAtMs = BigInt(unlockMs);
      const cleanHandle = xHandle.trim().toLowerCase().replace(/^@/, '');
      if (!cleanHandle) throw new Error('X handle is required');

      // 1. AES envelope
      setStep('encrypting');
      const plaintext = new TextEncoder().encode(text);
      const aesKey = randomAesKey();
      const ciphertext = await aesGcmEncrypt(plaintext, aesKey);
      const contentHash = await sha256(plaintext);

      // 2. Walrus
      setStep('uploading');
      const { blobId } = await storeBlob(ciphertext, 30);

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
        throw new Error('Transaction failed to execute on-chain');
      }
      const digest = signed.Transaction.digest;

      // 5. Confirm + pull objectChanges via follow-up RPC (effects-bcs alone
      //    doesn't include types)
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

      setStep('done');
      setResult({ predictionId: created.objectId, blobId, xHandle: cleanHandle });
      // Navigate to verify page after a beat so the user sees the success state
      setTimeout(() => router.push(`/verify/${created.objectId}`), 1500);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
      setStep('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="text" className="text-sm font-medium">
          Prediction
        </label>
        <textarea
          id="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={280}
          rows={3}
          required
          disabled={disabled}
          placeholder="BTC > 95k by 2026-06-30"
          className="rounded-md border border-neutral-300 bg-white p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50 dark:border-neutral-700 dark:bg-black"
        />
        <span className="self-end text-xs text-neutral-500">{charsLeft} chars left</span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="xhandle" className="text-sm font-medium">
          Your X handle (without @)
        </label>
        <input
          id="xhandle"
          type="text"
          value={xHandle}
          onChange={(e) => setXHandle(e.target.value)}
          required
          disabled={disabled}
          placeholder="elonmusk"
          className="rounded-md border border-neutral-300 bg-white p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50 dark:border-neutral-700 dark:bg-black"
        />
        <span className="text-xs text-neutral-500">
          Day 4 will replace this with X OAuth verification.
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="unlock" className="text-sm font-medium">
          Unlock at
        </label>
        <input
          id="unlock"
          type="datetime-local"
          value={unlockIso}
          onChange={(e) => setUnlockIso(e.target.value)}
          required
          disabled={disabled}
          className="rounded-md border border-neutral-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50 dark:border-neutral-700 dark:bg-black"
        />
        <span className="text-xs text-neutral-500">
          Until then no one — including you — can decrypt.
        </span>
      </div>

      <button
        type="submit"
        disabled={disabled || !account}
        className="rounded-md bg-black px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
      >
        {!account ? 'Connect wallet to seal' : 'Seal prediction'}
      </button>

      {step !== 'idle' && step !== 'done' && step !== 'error' && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
          {STEP_LABELS[step]}
        </div>
      )}
      {step === 'done' && result && (
        <div className="flex flex-col gap-2 rounded-md border border-green-300 bg-green-50 p-3 text-sm dark:border-green-800 dark:bg-green-950">
          <p className="font-medium text-green-900 dark:text-green-200">Sealed ✓</p>
          <p className="break-all font-mono text-xs text-green-900 dark:text-green-200">
            id: {result.predictionId}
          </p>
          <p className="break-all font-mono text-xs text-green-900 dark:text-green-200">
            walrus: {result.blobId}
          </p>
          <p className="text-xs text-green-900 dark:text-green-200">
            redirecting to{' '}
            <a className="underline" href={`/verify/${result.predictionId}`}>
              /verify/{result.predictionId.slice(0, 10)}…
            </a>
            {' · '}
            view profile{' '}
            <a className="underline" href={`/${result.xHandle}`}>
              @{result.xHandle}
            </a>
          </p>
        </div>
      )}
      {step === 'error' && error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm dark:border-red-800 dark:bg-red-950">
          <p className="font-medium text-red-900 dark:text-red-200">Error</p>
          <p className="mt-1 break-words text-red-900 dark:text-red-200">{error}</p>
        </div>
      )}
    </form>
  );
}
