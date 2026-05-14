// Server-side seal flow for the demo agent fleet. Same shape as
// lib/mcp-seal.ts but signs with the AGENT'S OWN keypair (sovereign agent)
// rather than the platform relay wallet.
//
// Each agent is a real Sui-native sovereign actor on-chain: it holds its own
// SUI, pays its own gas + fees, and the on-chain `publisher` is its own
// address. That's what makes the demo "real AI competing on a verifiable
// leaderboard" instead of "ours, dressed up."

import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { SealClient } from '@mysten/seal';
import { generateText } from 'ai';
import { aesGcmEncrypt, randomAesKey, sha256 } from './crypto';
import { storeBlob, epochsForUnlock } from './walrus';
import { encryptAesKey } from './seal';
import {
  sealPredictionAsAgentTx,
  SUI_TYPE,
  type SuiClient,
} from './sui';
import { env } from './env';
import type { AgentPersona } from './agent-personas';

// Same fee as lib/mcp-seal.ts — must match Registry.fee_for<SUI>().
const SUI_FEE_MIST = 50_000_000n;

export interface AgentSealResult {
  agentAlias: string;
  model: string;
  predictionText: string;
  predictionId: string;
  blobId: string;
  unlockAtMs: number;
  digest: string;
  publisher: string;
}

// Generate a prediction text via the agent's model, then seal it.
export async function generateAndSealAgentPrediction(opts: {
  suiClient: SuiClient;
  sealClient: SealClient;
  signer: Ed25519Keypair;
  persona: AgentPersona;
}): Promise<AgentSealResult> {
  const { suiClient, sealClient, signer, persona } = opts;

  // 1. Generate the prediction text via the agent's LLM
  const topic = pickRandom(persona.topicSeeds);
  const userPrompt =
    `Make ONE specific, testable prediction about: ${topic}\n\n` +
    `It must be objectively verifiable within the unlock window. Output ONLY ` +
    `the prediction text (240 chars max). Do not preface or explain.`;

  const result = await generateText({
    model: persona.model,
    system: persona.systemPrompt,
    prompt: userPrompt,
  });
  const predictionText = result.text.trim().replace(/^["']|["']$/g, '').slice(0, 240);
  if (predictionText.length < 10) {
    throw new Error(`${persona.alias} generated empty prediction; got: "${result.text}"`);
  }

  // 2. Pick an unlock time within the agent's preferred range
  const [minH, maxH] = persona.unlockHoursRange;
  const horizonHours = minH + Math.random() * (maxH - minH);
  const unlockAtMs = Date.now() + Math.floor(horizonHours * 3_600_000);

  // 3. Standard seal pipeline (AES → Walrus → Seal-encrypt key → Sui)
  const plaintext = new TextEncoder().encode(predictionText);
  const aesKey = randomAesKey();
  const ciphertext = await aesGcmEncrypt(plaintext, aesKey);
  const contentHash = await sha256(plaintext);
  const epochs = epochsForUnlock(unlockAtMs);
  const { blobId } = await storeBlob(ciphertext, epochs);
  const sealedKey = await encryptAesKey({
    seal: sealClient,
    aesKey,
    unlockAtMs: BigInt(unlockAtMs),
    packageId: env.packageId,
  });

  const tx = sealPredictionAsAgentTx({
    registryId: env.registryId,
    packageId: env.packageId,
    agentAlias: persona.alias,
    unlockAtMs: BigInt(unlockAtMs),
    contentHash,
    blobIdBytes: new TextEncoder().encode(blobId),
    sealedKey,
    feeCoinType: SUI_TYPE,
    feeAmount: SUI_FEE_MIST,
  });

  const signed = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: { showEffects: true, showObjectChanges: true },
  });
  if (signed.effects?.status?.status !== 'success') {
    throw new Error(
      `${persona.alias} seal failed: ${JSON.stringify(signed.effects?.status)}`,
    );
  }

  const created = signed.objectChanges?.find(
    (c: { type: string; objectType?: string; objectId?: string }) =>
      c.type === 'created' &&
      typeof c.objectType === 'string' &&
      c.objectType.endsWith('::prediction_vault::SealedPrediction'),
  ) as { type: 'created'; objectId: string; objectType: string } | undefined;
  if (!created) {
    throw new Error(`${persona.alias} seal succeeded but no SealedPrediction created`);
  }

  return {
    agentAlias: persona.alias,
    model: persona.model,
    predictionText,
    predictionId: created.objectId,
    blobId,
    unlockAtMs,
    digest: signed.digest,
    publisher: signer.getPublicKey().toSuiAddress(),
  };
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}
