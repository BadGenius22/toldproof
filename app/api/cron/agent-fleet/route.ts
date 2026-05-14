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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function checkAuth(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

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
  if (!checkAuth(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

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
  }> = [];

  for (const persona of AGENT_FLEET) {
    const signer = loadAgentKey(persona);
    if (!signer) {
      results.push({
        alias: persona.alias,
        status: 'skipped',
        error: `${persona.privateKeyEnvVar} not configured`,
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
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[agent-fleet] ${persona.alias}: ${msg}`);
      results.push({ alias: persona.alias, status: 'failed', error: msg });
    }
  }

  return Response.json({
    startedAt,
    durationMs: Date.now() - startedAt,
    fleetSize: AGENT_FLEET.length,
    sealed: results.filter((r) => r.status === 'sealed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
    results,
  });
}
