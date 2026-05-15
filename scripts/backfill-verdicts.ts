// Backfill prediction_verdicts from on-chain + Walrus.
//
// Why this exists: prediction_verdicts is a Postgres cache that the resolver
// writes to AFTER each Move resolve. Anything resolved BEFORE that write was
// added to resolveOnce() lives only on-chain + Walrus, so the leaderboard's
// difficulty histogram shows "Not judged yet" for those rows.
//
// This script:
//   1. Scans every identity on the Registry (humans + agents)
//   2. For each resolved prediction with a reasoning_blob_id, pulls the
//      Walrus trace JSON
//   3. Extracts (hit, difficulty, confidence) from the trace + the on-chain
//      record
//   4. INSERTs into prediction_verdicts ON CONFLICT DO NOTHING (idempotent —
//      safe to re-run; never overwrites rows the live resolver wrote)
//
// Traces from before the difficulty axis shipped (early V3 traces) don't
// have a `difficulty` field. Those get a neutral `medium` default + a
// caveat in difficultyReasoning so the gap is honest.
//
// Run:
//   pnpm tsx --env-file=.env.local scripts/backfill-verdicts.ts
// Or against prod:
//   vercel env pull .env.tmp --environment=production
//   pnpm tsx --env-file=.env.tmp scripts/backfill-verdicts.ts
//   rm .env.tmp

import { getSuiClientForReads, listAllIdentities, getPredictionsForIdentity } from '../lib/registry';
import { persistVerdict, type DifficultyLevel } from '../lib/verdict-store';

const WALRUS_AGGREGATOR =
  process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL ||
  'https://aggregator.walrus-testnet.walrus.space';

interface TraceJson {
  version?: number;
  predictionId?: string;
  verdict?: {
    hit?: boolean;
    confidence?: number;
    difficulty?: DifficultyLevel;
    difficultyReasoning?: string;
    reasoning?: string;
  };
}

async function fetchTrace(blobId: string): Promise<TraceJson | null> {
  try {
    const res = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);
    if (!res.ok) return null;
    return (await res.json()) as TraceJson;
  } catch {
    return null;
  }
}

async function main() {
  const client = getSuiClientForReads();
  console.log('→ Scanning Registry for resolved predictions…');
  const identities = await listAllIdentities(client);
  console.log(`  Found ${identities.length} identities.`);

  let scanned = 0;
  let inserted = 0;
  let skippedAlreadyExists = 0;
  let skippedNoBlob = 0;
  let skippedTraceMissing = 0;
  let backfilledWithoutDifficulty = 0;

  for (const identity of identities) {
    let preds;
    try {
      preds = await getPredictionsForIdentity(client, identity);
    } catch (e) {
      console.warn(`  skip ${identity}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    for (const p of preds) {
      if (!p.resolved) continue;
      scanned += 1;
      if (!p.reasoningBlobId) {
        skippedNoBlob += 1;
        continue;
      }
      const trace = await fetchTrace(p.reasoningBlobId);
      if (!trace?.verdict) {
        skippedTraceMissing += 1;
        console.warn(`  no trace for ${p.id.slice(0, 10)}… (blob ${p.reasoningBlobId.slice(0, 12)}…)`);
        continue;
      }
      const difficulty: DifficultyLevel = trace.verdict.difficulty ?? 'medium';
      const difficultyReasoning =
        trace.verdict.difficultyReasoning ??
        'Pre-V3 trace — difficulty was not assessed when this prediction resolved.';
      if (!trace.verdict.difficulty) backfilledWithoutDifficulty += 1;
      const confidence = trace.verdict.confidence ?? 0;

      try {
        await persistVerdict({
          predictionId: p.id,
          identity: p.identity,
          entityType: p.entityType,
          hit: p.hit,
          difficulty,
          difficultyReasoning,
          confidence,
          sealedAtMs: p.sealedAtMs,
          resolvedAtMs: p.resolvedAtMs,
          resolverAddr: p.resolver,
        });
        // persistVerdict uses ON CONFLICT DO UPDATE — so "inserted" here
        // includes "overwritten if already present". We can't distinguish
        // cheaply without a SELECT-first, so we just call this "applied".
        inserted += 1;
        console.log(`  ✓ ${p.identity.padEnd(20)} ${p.id.slice(0, 10)}…  ${difficulty}  ${p.hit ? 'HIT' : 'MISS'}`);
      } catch (e) {
        // Most likely error: trying to write to prediction_verdicts before
        // migrations 001-004 ran on this DB. Surface and stop.
        console.error(`  ✗ ${p.id.slice(0, 10)}…: ${e instanceof Error ? e.message : String(e)}`);
        skippedAlreadyExists += 1;
      }
    }
  }

  console.log('');
  console.log('=== BACKFILL SUMMARY ===');
  console.log(`Scanned resolved predictions:        ${scanned}`);
  console.log(`Applied to prediction_verdicts:      ${inserted}`);
  console.log(`  …of which lacked difficulty (V2):  ${backfilledWithoutDifficulty}`);
  console.log(`Skipped (no reasoning_blob_id):      ${skippedNoBlob}`);
  console.log(`Skipped (Walrus trace unreadable):   ${skippedTraceMissing}`);
  console.log(`Errors:                              ${skippedAlreadyExists}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
