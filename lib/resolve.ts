// Resolution Agent — multi-step tool-using AI that judges prediction outcomes.
//
// Full loop per prediction:
//   1. Read the revealed plaintext from on-chain SealedPrediction.
//   2. Run a tool-using Claude session via Vercel AI Gateway:
//        - web_search (Tavily) for general claims + news
//        - get_token_price (CoinGecko) for current price/marketcap
//        - get_price_history (CoinGecko) for time-bounded price claims
//        - submit_verdict to finalize
//      Up to 8 steps. The agent decides what to investigate.
//   3. Capture the full step-by-step trace + verdict into a JSON artifact.
//   4. Write the artifact to Walrus.
//   5. Submit resolve(prediction, hit, walrus_blob_id) on Sui — gated to the
//      Registry's `resolver` address.
//
// The Walrus artifact is the auditable record subscribers see: every search
// query, every tool result, every reasoning step. That's the Walrus-track
// "persistent verifiable agent memory" hook.

import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { generateText, stepCountIs, type LanguageModelUsage } from 'ai';
import { env } from './env';
import { storeBlob } from './walrus';
import {
  resolvePredictionTx,
  toBytes,
  fetchSealedPrediction,
  type SuiClient,
} from './sui';
import { RESOLUTION_AGENT_TOOLS, type Verdict } from './agent-tools';

const AGENT_MODEL = 'anthropic/claude-sonnet-4.5';
const MAX_AGENT_STEPS = 8;
const REASONING_TRACE_EPOCHS = 53;

const SYSTEM_PROMPT = `You are the TOLDPROOF Resolution Agent. Your one job: determine \
whether a sealed prediction actually came true. You operate on natural-language \
predictions about public events — crypto prices, ecosystem milestones, \
announcements, real-world outcomes.

You have these tools available:
  - web_search(query, maxResults): search the web for current information
  - get_token_price(symbolOrId): current USD price, market cap, 24h change
  - get_price_history(symbolOrId, days): historical price + market cap
  - submit_verdict(hit, confidence, reasoning, sources, caveats?): FINAL answer

Process:
  1. Read the prediction carefully. Note specific dates, thresholds, claims.
  2. Decide what evidence you need to verify or refute it.
  3. Call tools to gather that evidence. Be efficient — don't make redundant queries.
  4. When you have enough, call submit_verdict ONCE with your final answer.

Rules:
  - Be objective. Don't editorialize. Don't accuse the author of dishonesty.
  - If evidence is sparse or contradictory, set confidence below 0.5 and say so.
  - Every source in your verdict.sources MUST be a URL you actually saw via web_search,
    OR a tool name like "coingecko:ethereum" for price-tool data.
  - Maximum 8 tool calls total. Be efficient.
  - The reasoning you submit will be stored on Walrus where subscribers can audit
    every word. Be precise and cite specifics.`;

export interface ReasoningTrace {
  version: 2;
  predictionId: string;
  predictionText: string;
  identity: string;
  entityType: number;
  sealedAtMs: number;
  revealedAtMs: number;
  resolvedAtMs: number;
  model: string;
  verdict: Verdict;
  // Full agent step-by-step trace. Each entry captures one model turn:
  // what the model said + what tool calls it made + each tool's result.
  agentSteps: AgentStep[];
  totalSteps: number;
  tokenUsage: SerializedUsage;
}

export interface AgentStep {
  stepIndex: number;
  text: string; // model's reasoning text at this step (may be empty if tool-only step)
  toolCalls: Array<{
    tool: string;
    input: unknown;
    output: unknown;
  }>;
}

interface SerializedUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ResolveResult {
  predictionId: string;
  digest: string;
  reasoningBlobId: string;
  hit: boolean;
  confidence: number;
  totalSteps: number;
}

export async function resolveOnce(opts: {
  suiClient: SuiClient;
  signer: Ed25519Keypair;
  predictionId: string;
}): Promise<ResolveResult> {
  const { suiClient, signer, predictionId } = opts;

  // 1. Fetch + sanity-check prediction
  const pred = await fetchSealedPrediction(suiClient, predictionId);
  if (!pred.revealed) throw new Error(`prediction ${predictionId} not yet revealed`);
  if (pred.resolved === true) throw new Error(`prediction ${predictionId} already resolved`);

  const plaintext = new TextDecoder().decode(toBytes(pred.revealed_plaintext));
  const sealedAtMs = Number(pred.sealed_at_ms);
  const revealedAtMs = Number(pred.revealed_at_ms);
  const now = Date.now();
  const isAgent = pred.entity_type === 1;
  const entityLabel = isAgent ? 'AI agent' : 'human X user';

  const userPrompt = [
    `Prediction text: "${plaintext}"`,
    `Sealed by ${entityLabel}: ${pred.identity}`,
    `Locked at: ${new Date(sealedAtMs).toISOString()}`,
    `Opened at: ${new Date(revealedAtMs).toISOString()}`,
    `Current date: ${new Date(now).toISOString()}`,
    '',
    'Investigate this prediction and produce a verdict. Use the tools to gather ' +
      'evidence, then call submit_verdict.',
  ].join('\n');

  // 2. Run the multi-step tool-using agent loop
  const result = await generateText({
    model: AGENT_MODEL,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    tools: RESOLUTION_AGENT_TOOLS,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
  });

  // 3. Extract the verdict from the most recent submit_verdict tool call.
  //    If the agent never called submit_verdict (it ran out of steps), we
  //    fall back to a low-confidence "unable to determine" verdict.
  const verdict = extractVerdict(result.toolCalls, plaintext);

  // 4. Build the structured reasoning trace artifact
  const agentSteps = serializeSteps(result.steps);
  const trace: ReasoningTrace = {
    version: 2,
    predictionId,
    predictionText: plaintext,
    identity: pred.identity,
    entityType: pred.entity_type ?? 0,
    sealedAtMs,
    revealedAtMs,
    resolvedAtMs: Date.now(),
    model: AGENT_MODEL,
    verdict,
    agentSteps,
    totalSteps: agentSteps.length,
    tokenUsage: serializeUsage(result.usage),
  };
  const traceBytes = new TextEncoder().encode(JSON.stringify(trace, null, 2));

  // 5. Store on Walrus
  const { blobId } = await storeBlob(traceBytes, REASONING_TRACE_EPOCHS);

  // 6. Commit on Sui
  const tx = resolvePredictionTx({
    registryId: env.registryId,
    packageId: env.packageId,
    predictionId,
    hit: verdict.hit,
    reasoningBlobIdBytes: new TextEncoder().encode(blobId),
  });
  const signed = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: { showEffects: true },
  });
  const status = signed.effects?.status?.status;
  if (status !== 'success') {
    throw new Error(`resolve tx failed: ${JSON.stringify(signed.effects?.status)}`);
  }

  return {
    predictionId,
    digest: signed.digest,
    reasoningBlobId: blobId,
    hit: verdict.hit,
    confidence: verdict.confidence,
    totalSteps: agentSteps.length,
  };
}

// Pull the verdict out of the agent's `submit_verdict` tool call.
// Falls back to a low-confidence "indeterminate" if the agent ran out of steps
// without committing — preserves auditability over silent failure.
function extractVerdict(
  toolCalls: ReadonlyArray<{ toolName: string; input?: unknown }>,
  plaintext: string,
): Verdict {
  // Iterate in reverse — the agent should call submit_verdict last
  for (let i = toolCalls.length - 1; i >= 0; i -= 1) {
    const call = toolCalls[i]!;
    if (call.toolName === 'submit_verdict' && call.input) {
      // input is already validated against VerdictSchema by AI SDK
      return call.input as Verdict;
    }
  }
  // Agent never finalized — synthesize a placeholder verdict so the on-chain
  // record is honest about the failure. Confidence is set to 0 so this never
  // contaminates an analyst's hit-rate.
  return {
    hit: false,
    confidence: 0,
    reasoning:
      `Resolution Agent did not produce a verdict for "${plaintext.slice(0, 80)}…" ` +
      `within the step limit. This typically means the tools available could not ` +
      `surface enough evidence. Treat this resolution as INDETERMINATE.`,
    sources: [],
    caveats: 'Agent timed out without calling submit_verdict.',
  };
}

function serializeSteps(
  steps: ReadonlyArray<{
    text?: string;
    toolCalls?: ReadonlyArray<{ toolName: string; input?: unknown }>;
    toolResults?: ReadonlyArray<{ toolName: string; output?: unknown }>;
  }>,
): AgentStep[] {
  return steps.map((s, idx) => {
    const calls = s.toolCalls ?? [];
    const results = s.toolResults ?? [];
    // Pair each tool call with its corresponding result (by index — they're aligned in AI SDK).
    const toolCalls = calls.map((c, i) => ({
      tool: c.toolName,
      input: c.input,
      output: results[i]?.output ?? null,
    }));
    return {
      stepIndex: idx,
      text: s.text ?? '',
      toolCalls,
    };
  });
}

function serializeUsage(u: LanguageModelUsage | undefined): SerializedUsage {
  if (!u) return {};
  return {
    inputTokens: u.inputTokens,
    outputTokens: u.outputTokens,
    totalTokens: u.totalTokens,
  };
}
