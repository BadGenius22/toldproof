// Verdict denormalization layer — Postgres cache of (hit, difficulty,
// confidence) for every resolved prediction. Used by the leaderboard's
// skill-score computation so we don't have to fetch every Walrus trace
// to render the rankings page.
//
// The Move contract is the source of truth for hit + resolved status. The
// Walrus blob is the source of truth for the reasoning + difficulty fields.
// This table is a CACHE — if it drifts (e.g. resolver crash mid-write),
// scripts/backfill-verdicts.ts can rebuild it from on-chain + Walrus data.

import { getSql } from './db';

export type DifficultyLevel = 'trivial' | 'easy' | 'medium' | 'hard';

export interface VerdictRecord {
  predictionId: string;
  identity: string;
  entityType: number;
  hit: boolean;
  difficulty: DifficultyLevel;
  difficultyReasoning?: string;
  confidence: number;
  sealedAtMs: number;
  resolvedAtMs: number;
  resolverAddr: string;
}

/**
 * Insert (or overwrite, on backfill) a verdict row. Called by resolveOnce
 * after the Move tx commits. Safe to call multiple times for the same
 * prediction — the ON CONFLICT clause keeps the row idempotent.
 */
export async function persistVerdict(v: VerdictRecord): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO prediction_verdicts (
      prediction_id,
      identity,
      entity_type,
      hit,
      difficulty,
      difficulty_reasoning,
      confidence,
      sealed_at_ms,
      resolved_at_ms,
      resolver_addr
    ) VALUES (
      ${v.predictionId},
      ${v.identity},
      ${v.entityType},
      ${v.hit},
      ${v.difficulty},
      ${v.difficultyReasoning ?? null},
      ${v.confidence},
      ${v.sealedAtMs},
      ${v.resolvedAtMs},
      ${v.resolverAddr}
    )
    ON CONFLICT (prediction_id) DO UPDATE SET
      hit = EXCLUDED.hit,
      difficulty = EXCLUDED.difficulty,
      difficulty_reasoning = EXCLUDED.difficulty_reasoning,
      confidence = EXCLUDED.confidence,
      resolved_at_ms = EXCLUDED.resolved_at_ms,
      resolver_addr = EXCLUDED.resolver_addr
  `;
}

export interface IdentityVerdictRow {
  prediction_id: string;
  hit: boolean;
  difficulty: DifficultyLevel;
  confidence: number;
  sealed_at_ms: number;
  resolved_at_ms: number;
}

/**
 * Load every verdict row for one identity. Cheap — indexed on LOWER(identity).
 * Used by the /[handle] profile page.
 */
export async function getVerdictsForIdentity(
  identity: string,
): Promise<IdentityVerdictRow[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT prediction_id, hit, difficulty, confidence, sealed_at_ms, resolved_at_ms
    FROM prediction_verdicts
    WHERE LOWER(identity) = LOWER(${identity})
    ORDER BY resolved_at_ms DESC
  `) as IdentityVerdictRow[];
  return rows;
}

/**
 * Load every verdict in the system — used by /leaderboard to build the
 * full ranked board. At hackathon scale (< 1000 verdicts) one scan is
 * fine; production would precompute aggregates.
 */
export async function getAllVerdicts(): Promise<
  Array<IdentityVerdictRow & { identity: string; entity_type: number }>
> {
  const sql = getSql();
  const rows = (await sql`
    SELECT
      prediction_id,
      identity,
      entity_type,
      hit,
      difficulty,
      confidence,
      sealed_at_ms,
      resolved_at_ms
    FROM prediction_verdicts
    ORDER BY resolved_at_ms DESC
  `) as Array<IdentityVerdictRow & { identity: string; entity_type: number }>;
  return rows;
}
