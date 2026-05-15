// Agent Fleet cron — every 6 hours, rotates through the demo fleet and
// generates one fresh prediction per agent. Over a week, populates the
// leaderboard with ~28 real AI-vs-AI predictions across Claude / GPT / Gemini.
//
// Each agent signs with ITS OWN keypair (sovereign agent model). Keypairs are
// loaded from per-agent env vars defined in lib/agent-personas.ts. If an
// agent's key isn't configured, that agent is silently skipped — the rest
// of the fleet still runs.
//
// Auth: same Bearer-token pattern as the other crons.

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SealClient } from '@mysten/seal';
import { getSuiClient } from '../../../../lib/sui-node';
import { AGENT_FLEET, type AgentPersona } from '../../../../lib/agent-personas';
import { generateAndSealAgentPrediction } from '../../../../lib/agent-seal-flow';
import { env } from '../../../../lib/env';
import { checkCronAuth } from '../../../../lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function loadAgentKey(persona: AgentPersona): Ed25519Keypair | null {
  const key = process.env[persona.privateKeyEnvVar];
  if (!key) return null;
  try {
    return Ed25519Keypair.fromSecretKey(key);
  } catch (e) {
    console.error(`[agent-fleet] ${persona.alias}: invalid key:`, e);
    return null;
  }
}

export async function GET(req: Request) {
  if (!checkCronAuth(req, '/api/cron/agent-fleet')) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Backfill mode (P0-3): seed-demo-fleet.ts hits this endpoint with
  // ?backfill=N to loop the full fleet N times, getting each agent above
  // the 3+ settled threshold for ranking on the leaderboard. Default 1 for
  // the every-6h Vercel cron invocation. Capped at 10 to bound runtime.
  const url = new URL(req.url);
  const backfillRaw = url.searchParams.get('backfill');
  const passes = Math.min(
    10,
    Math.max(1, Number.parseInt(backfillRaw ?? '1', 10) || 1),
  );

  const startedAt = Date.now();
  const suiClient = getSuiClient();
  const sealServers = [
    { objectId: env.sealKeyServer1, weight: 1 },
    { objectId: env.sealKeyServer2, weight: 1 },
    { objectId: env.sealKeyServer3, weight: 1 },
  ].filter((s) => s.objectId);
  const sealClient = new SealClient({
    suiClient,
    serverConfigs: sealServers,
    verifyKeyServers: false,
  });

  const results: Array<{
    alias: string;
    status: 'sealed' | 'skipped' | 'failed';
    predictionText?: string;
    predictionId?: string;
    blobId?: string;
    unlockAtMs?: number;
    digest?: string;
    error?: string;
    pass?: number;
  }> = [];

  for (let pass = 1; pass <= passes; pass += 1) {
    for (const persona of AGENT_FLEET) {
      const signer = loadAgentKey(persona);
      if (!signer) {
        results.push({
          alias: persona.alias,
          status: 'skipped',
          error: `${persona.privateKeyEnvVar} not configured`,
          pass,
        });
        continue;
      }
      try {
        const out = await generateAndSealAgentPrediction({
          suiClient,
          sealClient,
          signer,
          persona,
        });
        results.push({
          alias: out.agentAlias,
          status: 'sealed',
          predictionText: out.predictionText,
          predictionId: out.predictionId,
          blobId: out.blobId,
          unlockAtMs: out.unlockAtMs,
          digest: out.digest,
          pass,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[agent-fleet] pass ${pass} ${persona.alias}: ${msg}`);
        results.push({ alias: persona.alias, status: 'failed', error: msg, pass });
      }
    }
  }

  return Response.json({
    startedAt,
    durationMs: Date.now() - startedAt,
    fleetSize: AGENT_FLEET.length,
    passes,
    sealed: results.filter((r) => r.status === 'sealed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
    results,
  });
}
