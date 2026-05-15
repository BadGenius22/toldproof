// Resolution Agent — multi-step tool-using AI that judges prediction outcomes.
//
// Two modes, switchable via RESOLUTION_AGENT_MODE env var:
//   - "single" (default): one model (Claude) runs the tool-loop and submits a verdict.
//   - "consensus": Claude + GPT + Gemini each run the tool-loop independently in
//     parallel. A Critic Agent synthesizes the three verdicts into the final
//     attestation. All four reasoning paths are captured in the Walrus artifact.
//
// The Walrus artifact is the auditable record subscribers see — every model's
// thinking, every search query, every tool result. That's the Walrus-track
// "persistent verifiable agent memory + multi-agent coordination" hook.

import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {
  generateObject,
  generateText,
  hasToolCall,
  stepCountIs,
  type LanguageModelUsage,
} from 'ai';
import { env } from './env';
import { storeBlob } from './walrus';
import {
  resolvePredictionTx,
  toBytes,
  fetchSealedPrediction,
  type SuiClient,
} from './sui';
import {
  RESOLUTION_AGENT_TOOLS,
  VerdictSchema,
  type Verdict,
} from './agent-tools';

const MAX_AGENT_STEPS = 8;
const REASONING_TRACE_EPOCHS = 53;

// Default single-model mode uses Claude. Consensus mode fans out to all three.
const SINGLE_MODEL = 'anthropic/claude-sonnet-4.5';

// Multi-agent consensus models. Each runs the same worker prompt + tools
// independently. The Critic compares verdicts and synthesizes the final call.
// All three are routed through Vercel AI Gateway (no provider SDKs needed).
const CONSENSUS_MODELS = [
  'anthropic/claude-sonnet-4.5',
  'openai/gpt-5',
  'google/gemini-2.5-pro',
] as const;

const CRITIC_MODEL = 'anthropic/claude-sonnet-4.5';

type ResolutionMode = 'single' | 'consensus';

function modeFromEnv(): ResolutionMode {
  return process.env.RESOLUTION_AGENT_MODE === 'consensus' ? 'consensus' : 'single';
}

const WORKER_SYSTEM_PROMPT = `You are a TOLDPROOF Resolution Worker Agent. Your job: \
determine (1) whether a sealed prediction came true and (2) how uncertain it was \
at the moment the user locked it. You operate on natural-language predictions about \
public events — crypto prices, ecosystem milestones, announcements, real-world outcomes.

You have these tools available:
  - web_search(query, maxResults): search the web for current information
  - get_token_price(symbolOrId): current USD price, market cap, 24h change
  - get_price_history(symbolOrId, days): historical price + market cap
  - submit_verdict(hit, confidence, reasoning, sources, caveats?, difficulty, difficultyReasoning): FINAL answer

Process:
  1. Read the prediction carefully. Note specific dates, thresholds, claims.
  2. Decide what evidence you need to verify or refute it.
  3. Call tools to gather that evidence. Be efficient — don't make redundant queries.
  4. CRITICAL: Before submitting, also assess DIFFICULTY at LOCK TIME.
     - For price predictions, you MUST call get_price_history with enough days to cover
       the lock date. Compare the price at lock time to the predicted threshold.
     - If the threshold was already met at lock time → difficulty = "trivial".
     - If the move required was within typical 24h volatility → difficulty = "easy".
     - If real uncertainty existed (could plausibly go either way) → difficulty = "medium".
     - If the outcome was contrarian / surprising → difficulty = "hard".
     - For non-price predictions, judge difficulty by how widely the outcome was expected
       at lock time (news context, base rates, prior probability).
  5. Call submit_verdict ONCE with hit + confidence + difficulty + difficultyReasoning.

Rules:
  - Be objective. Don't editorialize. Don't accuse the author of dishonesty.
  - If evidence is sparse or contradictory, set confidence below 0.5 and say so.
  - Every source in your verdict.sources MUST be a URL you actually saw via web_search,
    OR a tool name like "coingecko:ethereum" for price-tool data.
  - Maximum 8 tool calls total. Be efficient.
  - A "trivial" call is still a HIT if the condition is true — don't change hit/miss based
    on difficulty. Difficulty is a separate axis from correctness.
  - In consensus mode you are ONE of three independent investigators. Don't try to
    agree with the others — they're not visible. State your honest view, your
    confidence, your difficulty rating, and your evidence. A Critic Agent will synthesize.`;

const CRITIC_SYSTEM_PROMPT = `You are the TOLDPROOF Critic Agent. Three independent \
Worker Agents (Claude, GPT, Gemini) each investigated a sealed prediction \
and submitted a verdict. Your job: synthesize their three verdicts into one \
final answer.

Synthesis rules:
  - All 3 agree on hit/miss: commit consensus, confidence = average of the 3.
  - 2 of 3 agree: commit the majority view, confidence slightly below the
    majority's average, note the dissenting view in caveats (1-2 sentences).
  - All 3 disagree (rare, only if hit/miss is genuinely ambiguous): commit
    hit=false, confidence=0.0, write the disagreement honestly in caveats.
  - Merge sources from all 3 workers into your final sources array (dedupe URLs).
  - Your reasoning summarizes the workers' findings — do NOT invent new claims.
  - Never accuse the author of dishonesty. Just describe whether reality matched.

For DIFFICULTY (separate axis from hit/miss):
  - If all 3 workers picked the same difficulty: use it.
  - If 2 of 3 agree: use the majority.
  - If all 3 differ: pick the middle option of the three (trivial<easy<medium<hard).
  - Write a one-sentence difficultyReasoning that summarizes WHY (cite concrete
    numbers from the workers when possible, e.g. "BTC was $80,704 at lock time,
    above the $80,000 threshold").`;

// ─── Shared types ─────────────────────────────────────────────────────

export interface ReasoningTrace {
  version: 3;
  predictionId: string;
  predictionText: string;
  identity: string;
  entityType: number;
  sealedAtMs: number;
  revealedAtMs: number;
  resolvedAtMs: number;
  mode: ResolutionMode;
  verdict: Verdict;
  // Single-mode: one path under `singleAgent`.
  // Consensus-mode: one entry per worker model under `workers`, plus
  // `criticVerdicts` showing the three input verdicts the critic synthesized.
  singleAgent?: AgentRunRecord;
  workers?: AgentRunRecord[];
  criticInputs?: WorkerVerdict[];
  criticReasoning?: string;
  totalTokenUsage: SerializedUsage;
}

export interface AgentRunRecord {
  model: string;
  steps: AgentStep[];
  totalSteps: number;
  tokenUsage: SerializedUsage;
  verdict: Verdict;
}

export interface AgentStep {
  stepIndex: number;
  text: string;
  toolCalls: Array<{
    tool: string;
    input: unknown;
    output: unknown;
  }>;
}

interface WorkerVerdict {
  model: string;
  verdict: Verdict;
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
  mode: ResolutionMode;
}

// ─── Main entry ───────────────────────────────────────────────────────

export async function resolveOnce(opts: {
  suiClient: SuiClient;
  signer: Ed25519Keypair;
  predictionId: string;
}): Promise<ResolveResult> {
  const { suiClient, signer, predictionId } = opts;
  const mode = modeFromEnv();

  // 1. Fetch + sanity-check
  const pred = await fetchSealedPrediction(suiClient, predictionId);
  if (!pred.revealed) throw new Error(`prediction ${predictionId} not yet revealed`);
  if (pred.resolved === true)
    throw new Error(`prediction ${predictionId} already resolved`);

  const plaintext = new TextDecoder().decode(toBytes(pred.revealed_plaintext));
  const sealedAtMs = Number(pred.sealed_at_ms);
  const revealedAtMs = Number(pred.revealed_at_ms);

  // 2. Run agent(s) — single or consensus
  const ctx = {
    plaintext,
    identity: pred.identity,
    entityType: pred.entity_type ?? 0,
    sealedAtMs,
    revealedAtMs,
  };

  const trace: ReasoningTrace =
    mode === 'consensus'
      ? await runConsensus(predictionId, ctx)
      : await runSingleModel(predictionId, ctx);

  // 3. Store rich trace on Walrus
  const traceBytes = new TextEncoder().encode(JSON.stringify(trace, null, 2));
  const { blobId } = await storeBlob(traceBytes, REASONING_TRACE_EPOCHS);

  // 4. Commit on Sui
  const tx = resolvePredictionTx({
    registryId: env.registryId,
    packageId: env.packageId,
    predictionId,
    hit: trace.verdict.hit,
    reasoningBlobIdBytes: new TextEncoder().encode(blobId),
  });
  const signed = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: { showEffects: true },
  });
  if (signed.effects?.status?.status !== 'success') {
    throw new Error(`resolve tx failed: ${JSON.stringify(signed.effects?.status)}`);
  }

  // Wait for the RPC fullnode to index the resolved state so the verify page's
  // next getObject() after router.refresh()/reload sees resolved:true. Same
  // read-after-write consistency fix applied to revealOnce().
  await suiClient.waitForTransaction({ digest: signed.digest });

  return {
    predictionId,
    digest: signed.digest,
    reasoningBlobId: blobId,
    hit: trace.verdict.hit,
    confidence: trace.verdict.confidence,
    mode,
  };
}

// ─── Single-model path (default) ──────────────────────────────────────

interface AgentContext {
  plaintext: string;
  identity: string;
  entityType: number;
  sealedAtMs: number;
  revealedAtMs: number;
}

async function runSingleModel(
  predictionId: string,
  ctx: AgentContext,
): Promise<ReasoningTrace> {
  const run = await runWorkerAgent(SINGLE_MODEL, ctx);
  return {
    version: 3,
    predictionId,
    predictionText: ctx.plaintext,
    identity: ctx.identity,
    entityType: ctx.entityType,
    sealedAtMs: ctx.sealedAtMs,
    revealedAtMs: ctx.revealedAtMs,
    resolvedAtMs: Date.now(),
    mode: 'single',
    verdict: run.verdict,
    singleAgent: run,
    totalTokenUsage: run.tokenUsage,
  };
}

// ─── Consensus path (Claude + GPT + Gemini + Critic) ──────────────────

async function runConsensus(
  predictionId: string,
  ctx: AgentContext,
): Promise<ReasoningTrace> {
  // 1. Fan out to all three worker models in parallel.
  const workerResults = await Promise.allSettled(
    CONSENSUS_MODELS.map((model) => runWorkerAgent(model, ctx)),
  );
  const workers = workerResults
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((r): r is AgentRunRecord => r !== null);

  // If every worker failed, fall back to a synthetic "indeterminate" trace.
  if (workers.length === 0) {
    return {
      version: 3,
      predictionId,
      predictionText: ctx.plaintext,
      identity: ctx.identity,
      entityType: ctx.entityType,
      sealedAtMs: ctx.sealedAtMs,
      revealedAtMs: ctx.revealedAtMs,
      resolvedAtMs: Date.now(),
      mode: 'consensus',
      verdict: {
        hit: false,
        confidence: 0,
        reasoning: 'All three consensus worker agents failed to produce a verdict.',
        sources: [],
        caveats:
          'Treat this resolution as INDETERMINATE — every model errored before submitting.',
        difficulty: 'medium',
        difficultyReasoning:
          'Unable to assess — all workers errored before completing analysis.',
      },
      workers: [],
      criticInputs: [],
      criticReasoning: 'No successful worker verdicts to synthesize.',
      totalTokenUsage: {},
    };
  }

  // 2. Critic synthesizes
  const criticInputs: WorkerVerdict[] = workers.map((w) => ({
    model: w.model,
    verdict: w.verdict,
  }));
  const { finalVerdict, criticReasoning, criticUsage } = await runCriticAgent(
    ctx,
    criticInputs,
  );

  // 3. Aggregate token usage
  const totalUsage: SerializedUsage = {
    inputTokens:
      workers.reduce((acc, w) => acc + (w.tokenUsage.inputTokens ?? 0), 0) +
      (criticUsage.inputTokens ?? 0),
    outputTokens:
      workers.reduce((acc, w) => acc + (w.tokenUsage.outputTokens ?? 0), 0) +
      (criticUsage.outputTokens ?? 0),
    totalTokens:
      workers.reduce((acc, w) => acc + (w.tokenUsage.totalTokens ?? 0), 0) +
      (criticUsage.totalTokens ?? 0),
  };

  return {
    version: 3,
    predictionId,
    predictionText: ctx.plaintext,
    identity: ctx.identity,
    entityType: ctx.entityType,
    sealedAtMs: ctx.sealedAtMs,
    revealedAtMs: ctx.revealedAtMs,
    resolvedAtMs: Date.now(),
    mode: 'consensus',
    verdict: finalVerdict,
    workers,
    criticInputs,
    criticReasoning,
    totalTokenUsage: totalUsage,
  };
}

// ─── Worker agent (one model, full tool loop) ────────────────────────

async function runWorkerAgent(
  model: string,
  ctx: AgentContext,
): Promise<AgentRunRecord> {
  const now = Date.now();
  const isAgent = ctx.entityType === 1;
  const entityLabel = isAgent ? 'AI agent' : 'human X user';

  const userPrompt = [
    `Prediction text: "${ctx.plaintext}"`,
    `Sealed by ${entityLabel}: ${ctx.identity}`,
    `Locked at: ${new Date(ctx.sealedAtMs).toISOString()}`,
    `Opened at: ${new Date(ctx.revealedAtMs).toISOString()}`,
    `Current date: ${new Date(now).toISOString()}`,
    '',
    'Investigate this prediction. Use the tools to gather evidence, then call ' +
      'submit_verdict.',
  ].join('\n');

  const result = await generateText({
    model,
    system: WORKER_SYSTEM_PROMPT,
    prompt: userPrompt,
    tools: RESOLUTION_AGENT_TOOLS,
    // Stop on EITHER step cap OR submit_verdict — without the hasToolCall
    // condition the model would keep generating a closing message after
    // submitting the verdict, which (a) wastes tokens and (b) makes
    // result.toolCalls (final-step-only in AI SDK v6) miss the verdict call.
    stopWhen: [stepCountIs(MAX_AGENT_STEPS), hasToolCall('submit_verdict')],
  });

  return {
    model,
    steps: serializeSteps(result.steps),
    totalSteps: result.steps.length,
    tokenUsage: serializeUsage(result.usage),
    // Pass result.steps (not result.toolCalls) — submit_verdict may be in any
    // step, not just the last, and result.toolCalls only surfaces the final
    // step's calls in AI SDK v6.
    verdict: extractVerdict(result.steps, ctx.plaintext),
  };
}

// ─── Critic agent (synthesizes worker verdicts) ──────────────────────

async function runCriticAgent(
  ctx: AgentContext,
  inputs: WorkerVerdict[],
): Promise<{ finalVerdict: Verdict; criticReasoning: string; criticUsage: SerializedUsage }> {
  const inputBlock = inputs
    .map(
      (i, idx) =>
        `WORKER ${idx + 1} — ${i.model}\n` +
        `  hit: ${i.verdict.hit}\n` +
        `  confidence: ${i.verdict.confidence.toFixed(2)}\n` +
        `  reasoning: ${i.verdict.reasoning}\n` +
        `  sources: ${JSON.stringify(i.verdict.sources)}\n` +
        (i.verdict.caveats ? `  caveats: ${i.verdict.caveats}\n` : ''),
    )
    .join('\n');

  const prompt = [
    `Prediction: "${ctx.plaintext}"`,
    `Sealed by: ${ctx.identity} (${ctx.entityType === 1 ? 'AI agent' : 'human'})`,
    `Sealed at: ${new Date(ctx.sealedAtMs).toISOString()}`,
    `Opened at: ${new Date(ctx.revealedAtMs).toISOString()}`,
    '',
    'WORKER VERDICTS:',
    inputBlock,
    '',
    'Synthesize the final verdict per the critic rules. Include all unique sources ' +
      'from the workers in your sources array.',
  ].join('\n');

  const result = await generateObject({
    model: CRITIC_MODEL,
    schema: VerdictSchema,
    system: CRITIC_SYSTEM_PROMPT,
    prompt,
  });

  return {
    finalVerdict: result.object,
    criticReasoning: result.object.reasoning,
    criticUsage: serializeUsage(result.usage),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

function extractVerdict(
  steps: ReadonlyArray<{ toolCalls?: ReadonlyArray<{ toolName: string; input?: unknown }> }>,
  plaintext: string,
): Verdict {
  // Walk steps in reverse so the last submit_verdict wins (defensive — the
  // hasToolCall stop should have ensured there's exactly one, but be safe).
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const calls = steps[i]?.toolCalls ?? [];
    for (let j = calls.length - 1; j >= 0; j -= 1) {
      const call = calls[j]!;
      if (call.toolName === 'submit_verdict' && call.input) {
        // The AI SDK validates against VerdictSchema before executing the
        // tool, but the toolCalls array is typed `input?: unknown` —
        // re-parse here so a partially-validated or malformed entry can't
        // lie about its shape.
        const parsed = VerdictSchema.safeParse(call.input);
        if (parsed.success) return parsed.data;
      }
    }
  }
  return {
    hit: false,
    confidence: 0,
    reasoning:
      `Resolution Agent did not produce a verdict for "${plaintext.slice(0, 80)}…" ` +
      `within the step limit. Treat this resolution as INDETERMINATE.`,
    sources: [],
    caveats: 'Agent timed out without calling submit_verdict.',
    difficulty: 'medium',
    difficultyReasoning: 'Unable to assess — agent timed out before completing analysis.',
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
    const toolCalls = calls.map((c, i) => ({
      tool: c.toolName,
      input: c.input,
      output: results[i]?.output ?? null,
    }));
    return { stepIndex: idx, text: s.text ?? '', toolCalls };
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
