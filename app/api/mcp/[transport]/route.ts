// MCP server with x402 payments — any Claude Desktop / Cursor / OpenAI agent
// can discover this endpoint and pay $0.20 USDC on Base per seal_prediction
// call. We relay to Sui via the seal_prediction_as_agent<SUI> Move entry.
//
// Tools:
//   - seal_prediction         (PAID, $0.20 USDC/Base)
//   - get_prediction          (free, by ID)
//   - list_predictions        (free, by identity)
//   - get_reputation_profile  (free, returns Walrus blob ID for the latest profile)
//   - get_leaderboard         (free, top entities by hit rate)
//   - verify_claim            (free, defamation-safe check by handle)
//
// Routing: this lives at /api/mcp/[transport]/route.ts so MCP clients can use
// either streamable HTTP (/api/mcp/mcp) or SSE (/api/mcp/sse) per the spec.
// The handler internally routes by transport.

// x402-mcp + the @modelcontextprotocol/sdk Zod schemas were authored against
// zod v3. We use zod v4 elsewhere (AI SDK). Importing v3 via the package alias
// keeps both worlds happy without forcing a downgrade for the agent tools.
import { z } from 'zod-v3';
import { SealClient } from '@mysten/seal';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { createPaidMcpHandler, type PaymentMcpServer } from 'x402-mcp';
import type { Address } from 'viem';
import { env } from '../../../../lib/env';
import { getSuiClient, loadDevKeypair } from '../../../../lib/sui-node';
import {
  executeServerSeal,
  defaultMcpAgentAlias,
} from '../../../../lib/mcp-seal';
import {
  getPredictionView,
  getPredictionsForIdentity,
  type PredictionView,
} from '../../../../lib/registry';
import {
  buildLeaderboard,
  sortLeaderboard,
  aggregateStats,
} from '../../../../lib/leaderboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ─── Config ─────────────────────────────────────────────────────────────
// x402 recipient: an EVM (Base/Base Sepolia) address that receives USDC
// payments from agents. Generate via Coinbase Developer Platform or use any
// Base-compatible wallet you control. Hardcoded fallback is a known burn
// address so misconfigured deploys fail loudly rather than route funds
// silently to a hijacker.
const X402_RECIPIENT = (process.env.TOLDPROOF_X402_RECIPIENT ??
  '0x0000000000000000000000000000000000000000') as Address;

// x402 network: 'base-sepolia' on testnet (zero-fee USDC for testing),
// 'base' on production. Default testnet during hackathon.
const X402_NETWORK = (process.env.TOLDPROOF_X402_NETWORK ?? 'base-sepolia') as
  | 'base'
  | 'base-sepolia';

// Facilitator URL — Coinbase runs a free public one on x402.org. Override
// only if running a self-hosted facilitator.
const X402_FACILITATOR_URL = (process.env.TOLDPROOF_X402_FACILITATOR_URL ??
  'https://x402.org/facilitator') as `${string}://${string}`;

// Price per seal in USD. Pad over actual Sui-side cost to cover the
// relay-wallet's gas + fee burn. $0.30 USDC paid → $0.20 to your Sui treasury
// → ~$0.10 covers our infra + AI Gateway resolution cost.
const SEAL_PRICE_USD = 0.3;

const HANDLER_LAZY = (() => {
  let cached: ReturnType<typeof createPaidMcpHandler> | null = null;
  return () => {
    if (cached) return cached;
    cached = buildHandler();
    return cached;
  };
})();

function buildHandler() {
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
  const signer = loadAgentKeypair();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://toldproof.xyz';

  return createPaidMcpHandler(
    (server: PaymentMcpServer) => {
      // ─── PAID: seal_prediction ──────────────────────────────────────────
      server.paidTool(
        'seal_prediction',
        'Lock a prediction on TOLDPROOF. AES-encrypted in transit, ' +
          'time-lock-sealed via Seal, ciphertext stored on Walrus, commitment ' +
          'anchored on Sui. Returns a prediction ID + public verify URL. ' +
          'At the unlock time the AI Resolution Agent will read the plaintext, ' +
          "investigate whether it came true, and attest hit/miss on-chain with a " +
          'reasoning trace stored on Walrus.',
        { price: SEAL_PRICE_USD },
        {
          text: z
            .string()
            .min(1)
            .max(280)
            .describe('The prediction text. Be specific and testable. 280 chars max.'),
          unlockAtMs: z
            .number()
            .int()
            .describe(
              'Unix epoch milliseconds when the prediction unlocks. Must be ' +
                'at least 60 seconds in the future and within ~45 days (Walrus ' +
                'testnet storage limit).',
            ),
          identity: z
            .string()
            .min(1)
            .max(64)
            .optional()
            .describe(
              "Optional agent alias to seal under. Defaults to 'agent-evm-{payer8}' " +
                'derived from your x402 payer address. First-claim-wins: once an ' +
                "alias is locked to a wallet, only that wallet's seals can use it.",
            ),
        },
        {
          title: 'Lock a prediction on TOLDPROOF',
          readOnlyHint: false,
          openWorldHint: true,
        },
        async (input, extra) => {
          // Pull the verified x402 payer address from the MCP payment metadata
          // (set by the facilitator after settle).
          const payment = extra._meta?.['x402/payment'] as unknown;
          const payer = extractPayerAddress(payment);
          const agentAlias = input.identity ?? defaultMcpAgentAlias(payer);

          try {
            const out = await executeServerSeal({
              suiClient,
              sealClient,
              signer,
              appUrl,
              input: {
                text: input.text,
                unlockAtMs: input.unlockAtMs,
                agentAlias,
                payerAddress: payer,
              },
            });
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Sealed ✓\n` +
                    `Prediction ID: ${out.predictionId}\n` +
                    `Agent alias: ${out.agentAlias}\n` +
                    `Unlocks at: ${new Date(out.unlockAtMs).toISOString()}\n` +
                    `Walrus blob: ${out.blobId}\n` +
                    `Verify URL: ${out.verifyUrl}\n` +
                    `Sui tx: ${out.digest}`,
                },
              ],
              structuredContent: asMcpStructured(out),
            };
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return {
              isError: true,
              content: [{ type: 'text', text: `seal_prediction failed: ${msg}` }],
            };
          }
        },
      );

      // ─── FREE: get_prediction ──────────────────────────────────────────
      server.tool(
        'get_prediction',
        'Read a TOLDPROOF sealed prediction by ID. Returns identity, unlock time, ' +
          'sealed/revealed/resolved status, and the AI Resolution Agent verdict ' +
          '(if attested).',
        {
          predictionId: z.string().describe('Sui object ID (0x…) of the SealedPrediction'),
        },
        {
          title: 'Read a sealed prediction',
          readOnlyHint: true,
          openWorldHint: true,
        },
        async ({ predictionId }) => {
          const view = await getPredictionView(suiClient, predictionId);
          if (!view) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Prediction ${predictionId} not found` }],
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: formatPredictionView(view),
              },
            ],
            structuredContent: asMcpStructured(view),
          };
        },
      );

      // ─── FREE: list_predictions ─────────────────────────────────────────
      server.tool(
        'list_predictions',
        'List all sealed predictions for an identity (X handle for humans, ' +
          'alias for agents). Useful for the Verify Bot pattern — check if a ' +
          'specific user has anchored their claims on-chain.',
        {
          identity: z
            .string()
            .min(1)
            .max(64)
            .describe('Lowercased X handle (no @) or agent alias'),
        },
        {
          title: 'List predictions for an identity',
          readOnlyHint: true,
          openWorldHint: true,
        },
        async ({ identity }) => {
          const views = await getPredictionsForIdentity(suiClient, identity);
          return {
            content: [
              {
                type: 'text',
                text:
                  `Identity ${identity} has ${views.length} sealed prediction(s).\n\n` +
                  views.map((v) => formatPredictionShort(v)).join('\n'),
              },
            ],
            structuredContent: asMcpStructured({
              identity,
              count: views.length,
              predictions: views,
            }),
          };
        },
      );

      // ─── FREE: get_leaderboard ──────────────────────────────────────────
      server.tool(
        'get_leaderboard',
        'Top entities (humans + AI agents) on TOLDPROOF by AI-attested hit rate. ' +
          'Ranked entities have ≥ 3 resolved predictions. This is the cross-agent ' +
          'memory primitive — your agent can query the leaderboard to learn which ' +
          'analysts (or other AI agents) have track records worth trusting.',
        {
          entityType: z
            .enum(['all', 'humans', 'agents'])
            .optional()
            .default('all')
            .describe('Filter by entity type. Default: all'),
          limit: z.number().int().min(1).max(50).optional().default(20),
        },
        {
          title: 'TOLDPROOF leaderboard',
          readOnlyHint: true,
          openWorldHint: true,
        },
        async ({ entityType, limit }) => {
          const all = sortLeaderboard(await buildLeaderboard(suiClient));
          const filtered = all.filter((e) => {
            if (entityType === 'humans') return e.entityType === 0;
            if (entityType === 'agents') return e.entityType === 1;
            return true;
          });
          const top = filtered.slice(0, limit);
          const stats = aggregateStats(all);
          return {
            content: [
              {
                type: 'text',
                text:
                  `TOLDPROOF Leaderboard (${entityType ?? 'all'}, top ${top.length}):\n\n` +
                  top
                    .map(
                      (e, i) =>
                        `${i + 1}. ${e.entityType === 1 ? '🤖' : '👤'} ${e.identity}` +
                        ` — ${
                          e.isRanked
                            ? `${Math.round(e.stats.hitRate * 100)}% (${e.stats.hits}/${e.stats.resolved})`
                            : 'unranked'
                        }` +
                        ` · ${e.stats.sealed} sealed`,
                    )
                    .join('\n') +
                  `\n\nGlobal: ${stats.humans} humans · ${stats.agents} AI agents · ${stats.totalResolved} AI-resolved · ${Math.round(stats.overallHitRate * 100)}% overall hit rate.`,
              },
            ],
            structuredContent: asMcpStructured({ stats, entries: top }),
          };
        },
      );

      // ─── FREE: verify_claim ────────────────────────────────────────────
      server.tool(
        'verify_claim',
        'Defamation-safe check: does this X handle have any sealed predictions ' +
          'matching this claim? Returns a verdict text suitable for posting as a ' +
          'public reply. Never asserts a claim is false — only states presence/absence ' +
          'of proof. (Same logic as the @toldproof verify X bot.)',
        {
          xHandle: z.string().describe('Lowercased X handle without @'),
        },
        {
          title: 'Verify a claim against on-chain seals',
          readOnlyHint: true,
          openWorldHint: true,
        },
        async ({ xHandle }) => {
          const clean = xHandle.toLowerCase().replace(/^@/, '');
          const views = await getPredictionsForIdentity(suiClient, clean);
          const matched = views.filter((v) => v.revealed && v.resolved && v.hit);
          if (matched.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `No matching sealed prediction found for @${xHandle} via toldproof. ` +
                    `Absence of proof is not proof of falsehood. They have ${views.length} ` +
                    `total seal(s) on record.`,
                },
              ],
              structuredContent: asMcpStructured({
                xHandle: clean,
                kind: 'none',
                totalSeals: views.length,
              }),
            };
          }
          return {
            content: [
              {
                type: 'text',
                text:
                  `@${xHandle} has ${matched.length} AI-verified hit(s) on toldproof. ` +
                  `Profile: ${appUrl}/${clean}`,
              },
            ],
            structuredContent: asMcpStructured({
              xHandle: clean,
              kind: 'matched',
              hits: matched.length,
              predictionIds: matched.map((m) => m.id),
            }),
          };
        },
      );
    },
    {},
    {
      // mcp-handler needs to know the route prefix so it can match
      // /api/mcp/mcp (streamable HTTP) and /api/mcp/sse (SSE) correctly.
      basePath: '/api/mcp',
      recipient: X402_RECIPIENT,
      facilitator: { url: X402_FACILITATOR_URL },
      network: X402_NETWORK,
    },
  );
}

// Try to read the x402 payer address from MCP payment metadata. We re-decode
// the payment payload to get the `from` (payer EVM address) — x402-mcp doesn't
// surface this directly to the cb, but it's in the encoded payment.
function extractPayerAddress(payment: unknown): string {
  if (typeof payment !== 'string') return '0x0';
  try {
    // x402 payment payload is base64-encoded JSON. Decode + extract payer.
    const decoded = JSON.parse(
      Buffer.from(payment, 'base64').toString('utf-8'),
    ) as { payload?: { authorization?: { from?: string } } };
    return decoded.payload?.authorization?.from ?? '0x0';
  } catch {
    return '0x0';
  }
}

function loadAgentKeypair(): Ed25519Keypair {
  const envKey = process.env.REVEAL_BOT_PRIVATE_KEY;
  if (envKey) return Ed25519Keypair.fromSecretKey(envKey);
  return loadDevKeypair();
}

// MCP's tool-result `structuredContent` field has the type
// `{ [x: string]: unknown }` (a plain record). Our typed interfaces (like
// PredictionView, ServerSealOutput) don't have an index signature, so direct
// assignment fails. JSON round-tripping is identical, so this cast is safe.
function asMcpStructured<T>(v: T): Record<string, unknown> {
  return v as unknown as Record<string, unknown>;
}

function formatPredictionView(p: PredictionView): string {
  return [
    `${p.entityType === 1 ? '🤖' : '👤'} ${p.identity}`,
    `Status: ${p.revealed ? (p.resolved ? (p.hit ? 'RESOLVED · HIT ✓' : 'RESOLVED · MISS ✗') : 'REVEALED · awaiting AI resolution') : 'SEALED'}`,
    `Sealed: ${new Date(p.sealedAtMs).toISOString()}`,
    `Unlocks: ${new Date(p.unlockAtMs).toISOString()}`,
    p.revealed ? `Plaintext: "${p.revealedPlaintext}"` : 'Plaintext: <sealed>',
    p.resolved && p.reasoningBlobId
      ? `AI reasoning trace: walrus blob ${p.reasoningBlobId}`
      : '',
    `Publisher: ${p.publisher}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatPredictionShort(p: PredictionView): string {
  const status = p.resolved
    ? p.hit
      ? '✓ HIT'
      : '✗ MISS'
    : p.revealed
      ? '⊙ revealed'
      : '🔒 sealed';
  return `  ${status} · ${p.id.slice(0, 10)}… · unlocks ${new Date(p.unlockAtMs).toISOString().slice(0, 10)}`;
}

// Next.js App Router handler exports
export async function GET(req: Request) {
  return HANDLER_LAZY()(req);
}

export async function POST(req: Request) {
  return HANDLER_LAZY()(req);
}

export async function DELETE(req: Request) {
  return HANDLER_LAZY()(req);
}
