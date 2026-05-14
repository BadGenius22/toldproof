// Server-side seal flow for the MCP server. Mirrors the client-side
// PredictionForm.tsx pipeline but runs in a Vercel function under our relay
// wallet. Called by /api/mcp/[...path] when an agent invokes the paid
// `seal_prediction` tool.

import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { SealClient } from '@mysten/seal';
import { aesGcmEncrypt, randomAesKey, sha256 } from './crypto';
import { storeBlob, epochsForUnlock } from './walrus';
import { encryptAesKey } from './seal';
import {
  sealPredictionAsAgentTx,
  SUI_TYPE,
  type SuiClient,
  defaultAgentAlias,
} from './sui';
import { env } from './env';

// Fee in MIST — must match the Sui Registry's current set_fee<SUI>(...) value.
// Default 100M MIST = 0.1 SUI ≈ $0.20 at ~$2/SUI. Production should read this
// from on-chain via Registry.fee_for<SUI>() instead of hardcoding.
const SUI_FEE_MIST = 100_000_000n;

export interface ServerSealInput {
  text: string;
  unlockAtMs: number;
  agentAlias: string;
  // x402 payer EVM address (from the verified payment). Stored in the
  // ReasoningTrace for audit, NOT on-chain in v1. Future enhancement: bind
  // alias to payer via an EVM-address dynamic field on the Registry so the
  // alias is genuinely impersonation-proof in the relay model.
  payerAddress?: string;
}

export interface ServerSealOutput {
  predictionId: string;
  blobId: string;
  contentHashHex: string;
  sealedAtMs: number;
  unlockAtMs: number;
  agentAlias: string;
  digest: string;
  publisher: string;
  verifyUrl: string;
}

export async function executeServerSeal(opts: {
  suiClient: SuiClient;
  sealClient: SealClient;
  signer: Ed25519Keypair;
  appUrl: string;
  input: ServerSealInput;
}): Promise<ServerSealOutput> {
  const { suiClient, sealClient, signer, appUrl, input } = opts;
  const { text, unlockAtMs, agentAlias } = input;

  if (text.length === 0 || text.length > 280) {
    throw new Error('text must be 1..280 chars');
  }
  if (unlockAtMs <= Date.now() + 60_000) {
    throw new Error('unlockAtMs must be at least 60 seconds in the future');
  }

  // 1. AES envelope (browser-equivalent server-side)
  const plaintext = new TextEncoder().encode(text);
  const aesKey = randomAesKey();
  const ciphertext = await aesGcmEncrypt(plaintext, aesKey);
  const contentHash = await sha256(plaintext);

  // 2. Walrus
  const epochs = epochsForUnlock(unlockAtMs);
  const { blobId } = await storeBlob(ciphertext, epochs);

  // 3. Seal-encrypt the AES key under bcs(unlockAtMs)
  const sealedKey = await encryptAesKey({
    seal: sealClient,
    aesKey,
    unlockAtMs: BigInt(unlockAtMs),
    packageId: env.packageId,
  });

  // 4. Build PTB calling seal_prediction_as_agent<SUI>
  const tx = sealPredictionAsAgentTx({
    registryId: env.registryId,
    packageId: env.packageId,
    agentAlias,
    unlockAtMs: BigInt(unlockAtMs),
    contentHash,
    blobIdBytes: new TextEncoder().encode(blobId),
    sealedKey,
    feeCoinType: SUI_TYPE,
    feeAmount: SUI_FEE_MIST,
  });

  // 5. Sign + execute with the relay wallet (= reveal-bot keypair for now)
  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: { showEffects: true, showObjectChanges: true },
  });
  if (result.effects?.status?.status !== 'success') {
    throw new Error(
      `seal_prediction_as_agent failed: ${JSON.stringify(result.effects?.status)}`,
    );
  }

  // 6. Pull the created SealedPrediction objectId
  const created = result.objectChanges?.find(
    (c: { type: string; objectType?: string; objectId?: string }) =>
      c.type === 'created' &&
      typeof c.objectType === 'string' &&
      c.objectType.endsWith('::prediction_vault::SealedPrediction'),
  ) as { type: 'created'; objectId: string; objectType: string } | undefined;
  if (!created) throw new Error('seal succeeded but no SealedPrediction created');

  const contentHashHex = Array.from(contentHash)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    predictionId: created.objectId,
    blobId,
    contentHashHex,
    sealedAtMs: Date.now(),
    unlockAtMs,
    agentAlias,
    digest: result.digest,
    publisher: signer.getPublicKey().toSuiAddress(),
    verifyUrl: `${appUrl}/verify/${created.objectId}`,
  };
}

// Helper: derive an agent alias from a payer EVM address if the agent
// doesn't pass an explicit one. Mirrors the Sui-side defaultAgentAlias but
// for EVM-payer-bound usage in the relay model.
export function defaultMcpAgentAlias(payerEvmAddress: string): string {
  const short = payerEvmAddress.replace(/^0x/, '').slice(0, 8).toLowerCase();
  return `agent-evm-${short}`;
}

// Re-export for handler convenience
export { defaultAgentAlias };
