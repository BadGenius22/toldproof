// Reputation Agent — long-term Walrus-anchored memory of each identity.
//
// After the Resolution Agent attests outcomes, this agent aggregates them per
// identity into a versioned profile JSON. Each profile chains to its
// predecessor via `previousProfileBlobId` (linked list on Walrus) so anyone
// can audit how an analyst's track record evolved over time.
//
// The agent's job per identity:
//   1. Fetch all resolved predictions for the identity from Sui.
//   2. Compute mechanical stats (hit rate, average confidence, horizon).
//   3. Compute calibration buckets (was their confidence well-calibrated?).
//   4. Optionally enrich with an LLM-derived domain-accuracy breakdown +
//      narrative summary.
//   5. Build the profile JSON, link to previous version.
//   6. Write profile to Walrus.
//   7. Publish on-chain via prediction_vault::publish_reputation_profile().
//
// The Walrus-anchored profile IS the persistent agent memory the track wants.

import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { generateObject } from 'ai';
import { z } from 'zod';
import { env } from './env';
import { storeBlob } from './walrus';
import { publishReputationProfileTx, type SuiClient } from './sui';
import {
  getPredictionsForIdentity,
  type PredictionView,
} from './registry';

const REPUTATION_MODEL = 'anthropic/claude-sonnet-4.5';
const PROFILE_EPOCHS = 53;

// ─── Profile schema ───────────────────────────────────────────────────

export interface ReputationProfile {
  version: 1;
  schemaVersion: 1;
  identity: string;
  entityType: number;
  profileVersion: number; // monotonic per identity
  previousProfileBlobId: string; // empty for v1
  computedAtMs: number;
  model: string;

  stats: {
    totalSealed: number;
    totalRevealed: number;
    totalResolved: number;
    hits: number;
    misses: number;
    hitRate: number; // hits / resolved
    pendingResolution: number; // revealed but not yet resolved
    firstSealedAt: number;
    lastResolvedAt: number;
    medianHorizonDays: number; // seal → unlock window
  };

  calibration: {
    // Buckets the agent's stated confidence vs. actual accuracy
    // Three buckets: low (<0.5), mid (0.5–0.8), high (≥0.8)
    bucketLow: CalibrationBucket;
    bucketMid: CalibrationBucket;
    bucketHigh: CalibrationBucket;
    overallScore: number; // 0..1, 1.0 = perfectly calibrated
    isOverconfident: boolean;
  };

  domainAccuracy: DomainBreakdown[]; // LLM-derived, may be empty if no LLM call

  summary: string; // LLM-derived narrative; falls back to mechanical if no LLM

  // Audit trail
  predictionIds: string[];
  reasoningTraceBlobIds: string[];
}

interface CalibrationBucket {
  range: [number, number];
  samples: number;
  hits: number;
  accuracy: number; // hits / samples (0..1)
}

interface DomainBreakdown {
  domain: string; // e.g. "crypto-prices", "ecosystem-events", "macro"
  samples: number;
  hits: number;
  accuracy: number;
}

// ─── Aggregation helpers (mechanical, no LLM needed) ──────────────────

function computeMechanicalStats(predictions: PredictionView[]) {
  const revealed = predictions.filter((p) => p.revealed);
  const resolved = predictions.filter((p) => p.resolved);
  const hits = resolved.filter((p) => p.hit).length;
  const misses = resolved.length - hits;
  const pendingResolution = revealed.length - resolved.length;

  const horizons = predictions
    .map((p) => (p.unlockAtMs - p.sealedAtMs) / 86_400_000)
    .sort((a, b) => a - b);
  const medianHorizonDays = horizons.length
    ? horizons[Math.floor(horizons.length / 2)]!
    : 0;

  return {
    totalSealed: predictions.length,
    totalRevealed: revealed.length,
    totalResolved: resolved.length,
    hits,
    misses,
    hitRate: resolved.length > 0 ? hits / resolved.length : 0,
    pendingResolution,
    firstSealedAt:
      predictions.length > 0
        ? Math.min(...predictions.map((p) => p.sealedAtMs))
        : 0,
    lastResolvedAt:
      resolved.length > 0 ? Math.max(...resolved.map((p) => p.resolvedAtMs)) : 0,
    medianHorizonDays,
  };
}

function bucket(
  resolved: PredictionView[],
  reasoningConfidences: Map<string, number>,
  range: [number, number],
): CalibrationBucket {
  const inBucket = resolved.filter((p) => {
    const conf = reasoningConfidences.get(p.id) ?? 0.5;
    return conf >= range[0] && conf < range[1];
  });
  const hits = inBucket.filter((p) => p.hit).length;
  return {
    range,
    samples: inBucket.length,
    hits,
    accuracy: inBucket.length > 0 ? hits / inBucket.length : 0,
  };
}

function computeCalibration(
  resolved: PredictionView[],
  reasoningConfidences: Map<string, number>,
) {
  const bucketLow = bucket(resolved, reasoningConfidences, [0, 0.5]);
  const bucketMid = bucket(resolved, reasoningConfidences, [0.5, 0.8]);
  const bucketHigh = bucket(resolved, reasoningConfidences, [0.8, 1.01]);

  // Calibration score: 1.0 if accuracy in each bucket matches the midpoint of
  // its confidence range; lower as actual accuracy drifts from stated.
  const midpoints: Array<[CalibrationBucket, number]> = [
    [bucketLow, 0.25],
    [bucketMid, 0.65],
    [bucketHigh, 0.9],
  ];
  let weightedError = 0;
  let totalSamples = 0;
  for (const [b, mp] of midpoints) {
    if (b.samples > 0) {
      weightedError += b.samples * Math.abs(b.accuracy - mp);
      totalSamples += b.samples;
    }
  }
  const avgError = totalSamples > 0 ? weightedError / totalSamples : 0;
  const overallScore = Math.max(0, 1 - avgError * 2); // 0..1

  const isOverconfident =
    bucketHigh.samples >= 2 && bucketHigh.accuracy < 0.7;

  return {
    bucketLow,
    bucketMid,
    bucketHigh,
    overallScore,
    isOverconfident,
  };
}

// ─── LLM enrichment: per-domain accuracy + narrative summary ──────────

const EnrichmentSchema = z.object({
  domainAccuracy: z.array(
    z.object({
      domain: z
        .string()
        .describe(
          'Short topic label like "crypto-prices", "ecosystem-events", ' +
            '"macro", "tech-product-launches". Use lowercase hyphenated form.',
        ),
      samples: z.number(),
      hits: z.number(),
      accuracy: z.number().min(0).max(1),
    }),
  ),
  summary: z
    .string()
    .min(40)
    .describe(
      'Plain-English narrative summarizing this analyst/agent. 3-5 sentences. ' +
        'Cite specific stats from the data. Note strengths, weaknesses, and ' +
        'patterns. Never accuse anyone of dishonesty.',
    ),
});

async function llmEnrich(
  identity: string,
  entityType: number,
  predictions: PredictionView[],
  resolvedTraceLookup: Map<string, { confidence: number; reasoning: string }>,
): Promise<{ domainAccuracy: DomainBreakdown[]; summary: string }> {
  const resolved = predictions.filter((p) => p.resolved);
  if (resolved.length === 0) {
    return {
      domainAccuracy: [],
      summary: `@${identity} has no resolved predictions yet — track record will populate as predictions unlock and the AI Resolution Agent attests outcomes.`,
    };
  }

  const entityLabel = entityType === 1 ? 'AI agent' : 'human X user';
  const dataLines = resolved.map((p) => {
    const trace = resolvedTraceLookup.get(p.id);
    return [
      `- ID: ${p.id}`,
      `  Sealed: ${new Date(p.sealedAtMs).toISOString().slice(0, 10)}`,
      `  Resolved: ${new Date(p.resolvedAtMs).toISOString().slice(0, 10)}`,
      `  Text: "${p.revealedPlaintext}"`,
      `  Outcome: ${p.hit ? 'HIT' : 'MISS'}`,
      trace ? `  Agent confidence: ${trace.confidence.toFixed(2)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  });

  const userPrompt = [
    `Identity: ${identity} (${entityLabel})`,
    `Total resolved predictions: ${resolved.length}`,
    '',
    'Resolved predictions data:',
    ...dataLines,
    '',
    'Group these predictions into topic domains (max 6). For each domain, ' +
      'count samples + hits + compute accuracy. Then write a 3-5 sentence ' +
      'plain-English narrative summarizing this analyst\'s strengths, weaknesses, ' +
      'and patterns. Cite specific stats. The narrative will be public.',
  ].join('\n');

  const result = await generateObject({
    model: REPUTATION_MODEL,
    schema: EnrichmentSchema,
    system:
      'You are the TOLDPROOF Reputation Agent. You synthesize aggregated ' +
      'prediction-resolution data into a verifiable analyst profile. Be ' +
      'objective and specific. Never moralize.',
    prompt: userPrompt,
  });
  return result.object;
}

// ─── Main entry ───────────────────────────────────────────────────────

export async function buildAndPublishProfile(opts: {
  suiClient: SuiClient;
  signer: Ed25519Keypair;
  identity: string;
  previousProfileBlobId: string;
  previousVersion: number;
  /**
   * Map of predictionId → {confidence, reasoning} for resolved predictions.
   * Populated by the cron from the resolution traces (already on Walrus).
   * Pass empty Map if you don't have it — calibration will fall back to a
   * uniform 0.5 confidence per resolved prediction.
   */
  resolvedTraceLookup?: Map<string, { confidence: number; reasoning: string }>;
  /** If false, skip the LLM enrichment step (cheap "stats-only" mode). */
  enrich?: boolean;
}): Promise<{
  digest: string;
  profileBlobId: string;
  version: number;
  hitRate: number;
}> {
  const {
    suiClient,
    signer,
    identity,
    previousProfileBlobId,
    previousVersion,
    resolvedTraceLookup = new Map(),
    enrich = true,
  } = opts;

  // 1. Aggregate all predictions for this identity
  const predictions = await getPredictionsForIdentity(suiClient, identity);
  if (predictions.length === 0) {
    throw new Error(`identity ${identity} has no predictions to summarize`);
  }
  const entityType = predictions[0]!.entityType;

  // 2. Mechanical stats + calibration
  const stats = computeMechanicalStats(predictions);
  const resolved = predictions.filter((p) => p.resolved);
  const confidenceMap = new Map<string, number>();
  for (const p of resolved) {
    const trace = resolvedTraceLookup.get(p.id);
    if (trace) confidenceMap.set(p.id, trace.confidence);
  }
  const calibration = computeCalibration(resolved, confidenceMap);

  // 3. LLM enrichment (or fallback)
  const enrichment = enrich
    ? await llmEnrich(identity, entityType, predictions, resolvedTraceLookup)
    : {
        domainAccuracy: [] as DomainBreakdown[],
        summary: mechanicalSummary(identity, entityType, stats, calibration),
      };

  // 4. Build profile JSON
  const profile: ReputationProfile = {
    version: 1,
    schemaVersion: 1,
    identity,
    entityType,
    profileVersion: previousVersion + 1,
    previousProfileBlobId,
    computedAtMs: Date.now(),
    model: enrich ? REPUTATION_MODEL : 'mechanical-only',
    stats,
    calibration,
    domainAccuracy: enrichment.domainAccuracy,
    summary: enrichment.summary,
    predictionIds: predictions.map((p) => p.id),
    reasoningTraceBlobIds: resolved
      .map((p) => p.reasoningBlobId)
      .filter((b) => b.length > 0),
  };

  // 5. Write to Walrus
  const profileBytes = new TextEncoder().encode(JSON.stringify(profile, null, 2));
  const { blobId } = await storeBlob(profileBytes, PROFILE_EPOCHS);

  // 6. Publish on-chain
  const tx = publishReputationProfileTx({
    registryId: env.registryId,
    packageId: env.packageId,
    identity,
    profileBlobIdBytes: new TextEncoder().encode(blobId),
    previousBlobIdBytes: new TextEncoder().encode(previousProfileBlobId),
    version: BigInt(profile.profileVersion),
  });
  const signed = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: { showEffects: true },
  });
  const status = signed.effects?.status?.status;
  if (status !== 'success') {
    throw new Error(`publish_reputation_profile tx failed: ${JSON.stringify(signed.effects?.status)}`);
  }

  return {
    digest: signed.digest,
    profileBlobId: blobId,
    version: profile.profileVersion,
    hitRate: stats.hitRate,
  };
}

function mechanicalSummary(
  identity: string,
  entityType: number,
  stats: ReputationProfile['stats'],
  calibration: ReputationProfile['calibration'],
): string {
  const entityLabel = entityType === 1 ? 'AI agent' : 'analyst';
  if (stats.totalResolved === 0) {
    return `${identity} (${entityLabel}) has ${stats.totalSealed} sealed predictions; ${stats.pendingResolution} are revealed and awaiting AI resolution.`;
  }
  const pct = Math.round(stats.hitRate * 100);
  const cal = calibration.isOverconfident ? 'is slightly overconfident' : 'is reasonably calibrated';
  return `${identity} (${entityLabel}) is ${pct}% accurate over ${stats.totalResolved} resolved predictions and ${cal} based on stated confidence.`;
}
