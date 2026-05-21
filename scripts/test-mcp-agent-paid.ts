// The "killer demo" — combines AI agency with the x402 payment dance.
//
// An LLM (Claude via Vercel AI Gateway) receives a natural-language prompt,
// discovers the TOLDPROOF MCP tool catalog, and decides to call
// seal_prediction. The tool dispatch handler catches the x402 402 challenge,
// signs an EIP-3009 USDC payment with the agent wallet, retries, and the
// seal lands on Sui + Walrus. The LLM then writes a plain-English summary
// of what just happened — citing the new prediction ID.
//
// One terminal command, two layers of proof at once:
//   • Real LLM agency: model picks the tool unprompted
//   • Real USDC payment: $0.10 on Base Sepolia moves to the recipient
//   • Real on-chain receipt: new SealedPrediction at toldproof.xyz/verify/[id]
//
// Why we bypass MCP SDK for the paid call: x402-mcp@0.1.1 is built for AI
// SDK v5's experimental_createMCPClient (dropped in v6). We use MCP SDK
// for tool DISCOVERY (listTools), then for PAID tool EXECUTION we hit the
// JSON-RPC HTTP endpoint directly with our x402-aware fetch wrapper. Free
// tools still go through MCP SDK. AI SDK doesn't know the difference.
//
// Run:
//   pnpm tsx --env-file=.env.local scripts/test-mcp-agent-paid.ts
//   pnpm tsx --env-file=.env.local scripts/test-mcp-agent-paid.ts "your prompt"

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { generateText, stepCountIs, tool, jsonSchema, type ToolSet } from "ai";
import { createPaymentHeader, selectPaymentRequirements } from "x402/client";
import type { PaymentRequirements } from "x402/types";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http, publicActions } from "viem";
import { baseSepolia } from "viem/chains";

const MCP_URL =
  process.env.TOLDPROOF_MCP_URL || "https://toldproof.xyz/api/mcp/mcp";
const MODEL = process.env.MCP_TEST_MODEL || "anthropic/claude-sonnet-4.5";
const X402_VERSION = 1;
const DEFAULT_PROMPT =
  "You have access to TOLDPROOF tools. Lock a prediction that ETH will exceed $2,500 " +
  "within 24 hours. The unlock time should be 1 hour from now. After it locks, tell me " +
  "the prediction ID and the verify URL so I can show it off.";

// ─── x402-aware paid-tool dispatcher ─────────────────────────────────

interface SealReply {
  result?: {
    isError?: boolean;
    structuredContent?: unknown;
    content?: Array<{ type: string; text?: string }>;
  };
  error?: { message: string };
}

interface X402Challenge {
  x402Version: number;
  error: string;
  accepts: PaymentRequirements[];
}

async function readSseMessage(res: Response): Promise<SealReply> {
  const text = await res.text();
  const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
  if (!dataLine) throw new Error(`No SSE data frame: ${text.slice(0, 200)}`);
  return JSON.parse(dataLine.slice("data: ".length));
}

async function postMcpRpc(body: unknown): Promise<SealReply> {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
  return readSseMessage(res);
}

// x402-mcp's server reads the payment from MCP's JSON-RPC `_meta`
// extension at params._meta["x402/payment"], NOT from an HTTP header.
// (Confirmed via the x402-mcp@0.1.1 server.js source — see commit
// message for the full quote.) Build the params object with the payment
// embedded the way the adapter expects.
function buildSealParams(
  toolName: string,
  args: Record<string, unknown>,
  paymentHeader?: string,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    name: toolName,
    arguments: args,
  };
  if (paymentHeader) {
    params._meta = { "x402/payment": paymentHeader };
  }
  return params;
}

let rpcId = 0;
async function callToolWithAutoPayment(
  toolName: string,
  args: Record<string, unknown>,
  walletClient: unknown,
): Promise<unknown> {
  const buildRequest = (paymentHeader?: string) => ({
    jsonrpc: "2.0" as const,
    id: ++rpcId,
    method: "tools/call",
    params: buildSealParams(toolName, args, paymentHeader),
  });

  // First attempt — no payment. Free tools succeed here; paid tools return
  // an x402 challenge that we parse + sign + retry.
  let reply = await postMcpRpc(buildRequest());

  if (!reply.result?.isError) {
    // Free tool path — return the data unchanged.
    return reply.result?.structuredContent ?? reply.result?.content;
  }

  // Check whether the isError is an x402 challenge or a real error. The
  // x402-mcp adapter populates BOTH structuredContent (already parsed) AND
  // content[0].text (stringified). Prefer structuredContent.
  let challenge: X402Challenge | null = null;
  const sc = reply.result.structuredContent;
  if (
    sc &&
    typeof sc === "object" &&
    "x402Version" in sc &&
    "accepts" in sc &&
    Array.isArray((sc as { accepts: unknown }).accepts)
  ) {
    challenge = sc as X402Challenge;
  } else {
    const challengeText = reply.result.content?.[0]?.text;
    try {
      const parsed = challengeText ? JSON.parse(challengeText) : null;
      if (
        parsed &&
        typeof parsed === "object" &&
        "x402Version" in parsed &&
        "accepts" in parsed
      ) {
        challenge = parsed as X402Challenge;
      }
    } catch {
      /* not parseable — propagate */
    }
  }
  if (!challenge) {
    console.warn(`      ⚠ tool error (not x402 challenge):`);
    console.warn(
      `         structuredContent: ${JSON.stringify(sc).slice(0, 200)}`,
    );
    console.warn(
      `         content[0].text:   ${reply.result.content?.[0]?.text?.slice(0, 200)}`,
    );
    return { error: true, content: reply.result.content };
  }
  console.log(
    `      🔒 server demands payment (${challenge.accepts.length} option${
      challenge.accepts.length === 1 ? "" : "s"
    })`,
  );

  // Sign the payment.
  const requirement = selectPaymentRequirements(
    challenge.accepts,
    "base-sepolia",
    "exact",
  );
  const amount = Number(requirement.maxAmountRequired) / 1_000_000;
  console.log(
    `      💸 signing ${amount} USDC → ${requirement.payTo.slice(0, 10)}…`,
  );
  // REASON: x402 was built against viem ~2.13; we're on 2.48. Same runtime
  // (EIP-3009 signature is byte-compatible), incompatible structural type
  // on Block.transactions. Cast to the package's expected parameter type.
  const paymentHeader = await createPaymentHeader(
    walletClient as unknown as Parameters<typeof createPaymentHeader>[0],
    X402_VERSION,
    requirement,
  );

  // Retry with the payment in params._meta["x402/payment"].
  console.log(`      ⏳ retrying with _meta.x402/payment…`);
  reply = await postMcpRpc(buildRequest(paymentHeader));
  if (reply.result?.isError) {
    // Loud, full-text dump so we can see WHY the facilitator/server
    // rejected (most common: agent wallet has 0 USDC balance, so the
    // transferWithAuthorization() on Base Sepolia reverts).
    const errText = reply.result.content?.[0]?.text ?? "(no content text)";
    const sc = reply.result.structuredContent
      ? JSON.stringify(reply.result.structuredContent, null, 2)
      : "(no structuredContent)";
    console.error(`\n      ✗ retry rejected. Full server response:`);
    console.error(`         content[0].text:\n${errText}`);
    console.error(`         structuredContent:\n${sc}\n`);
    throw new Error(
      `Paid call rejected after payment. Most likely: agent wallet ${
        process.env.AGENT_BASE_PRIVATE_KEY
          ? privateKeyToAccount(
              process.env.AGENT_BASE_PRIVATE_KEY as `0x${string}`,
            ).address
          : "?"
      } has no Base Sepolia USDC. Fund at https://faucet.circle.com → Base Sepolia. Full server text: ${errText.slice(0, 300)}`,
    );
  }
  console.log(`      ✓ payment settled, seal landed`);
  return reply.result?.structuredContent ?? reply.result?.content;
}

// ─── main ─────────────────────────────────────────────────────────────

async function main() {
  const userPrompt = process.argv[2] || DEFAULT_PROMPT;

  // Wallet setup
  const pk = process.env.AGENT_BASE_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) {
    console.error("✗ AGENT_BASE_PRIVATE_KEY missing in env.");
    console.error(
      "  Run: pnpm tsx --env-file=.env.local scripts/test-mcp-paid-seal.ts setup --append",
    );
    process.exit(1);
  }
  const account = privateKeyToAccount(pk);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  }).extend(publicActions);

  console.log(`\n🔌 Connecting to ${MCP_URL}…`);
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  const mcp = new Client({ name: "toldproof-agent-paid", version: "1.0.0" });
  await mcp.connect(transport);

  const { tools: mcpTools } = await mcp.listTools();
  console.log(`✓ Connected. ${mcpTools.length} tools:`);
  for (const t of mcpTools) {
    const paid = (t.annotations as { paymentHint?: boolean } | undefined)
      ?.paymentHint;
    console.log(`    ${paid ? "💰" : "🆓"} ${t.name}`);
  }
  console.log(`\n💼 Agent wallet:  ${account.address}`);
  console.log(`💬 Prompt:        "${userPrompt}"\n`);
  console.log(`🤖 Running ${MODEL} with ${mcpTools.length} MCP tools…\n`);

  // Bridge MCP tools → AI SDK tools. Route ALL tools through the
  // payment-aware dispatcher — it short-circuits when the server doesn't
  // demand payment, and only triggers the x402 dance when the response is
  // an isError carrying a 402 challenge body. We don't trust the
  // `paymentHint` annotation because the MCP SDK's ToolAnnotations Zod
  // schema strips unknown fields, so the hint never reaches us.
  const aiTools: ToolSet = {};
  for (const t of mcpTools) {
    aiTools[t.name] = tool({
      description: t.description ?? `MCP tool ${t.name}`,
      inputSchema: jsonSchema(t.inputSchema as Record<string, unknown>),
      execute: async (args: unknown) => {
        const argsObj = args as Record<string, unknown>;
        console.log(`   🔧 ${t.name}`);
        return await callToolWithAutoPayment(t.name, argsObj, walletClient);
      },
    });
  }

  const startedAt = Date.now();
  // CRITICAL: LLMs default to their training-cutoff "now" when asked for
  // timestamps. Without this system message, Claude will compute unlockAtMs
  // from a 2024/2025 baseline and the Move contract will reject with
  // "unlock time must be in the future". Inject the real wall-clock so the
  // model has ground truth for relative-time math.
  const nowIso = new Date(startedAt).toISOString();
  const result = await generateText({
    model: MODEL,
    tools: aiTools,
    stopWhen: stepCountIs(5),
    system:
      `Current wall-clock time: ${nowIso} (Unix ms: ${startedAt}). ` +
      `Use THIS as "now" when computing any future timestamp like unlockAtMs. ` +
      `Do not use your training-cutoff date. unlockAtMs must be strictly greater than ${startedAt}.`,
    prompt: userPrompt,
  });

  console.log("\n═══ STEP-BY-STEP TRACE ═══");
  result.steps.forEach((step, i) => {
    const toolNames = (step.toolCalls ?? [])
      .map((c) => (c as { toolName: string }).toolName)
      .join(", ");
    console.log(
      `\n[Step ${i + 1}]${toolNames ? ` 🔧 ${toolNames}` : " 💭 reasoning"}`,
    );
    if (step.text) {
      console.log(
        `   text: ${step.text.slice(0, 200)}${step.text.length > 200 ? "…" : ""}`,
      );
    }
    (step.toolCalls ?? []).forEach((tc) => {
      const call = tc as { toolName: string; input?: unknown };
      const inp = JSON.stringify(call.input).slice(0, 120);
      console.log(`   ↳ args: ${inp}${inp.length === 120 ? "…" : ""}`);
    });
  });

  console.log("\n═══ FINAL ANSWER ═══\n");
  console.log(result.text);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("\n═══ USAGE ═══");
  console.log(`Steps:       ${result.steps.length}`);
  console.log(`Input tok:   ${result.usage.inputTokens ?? "?"}`);
  console.log(`Output tok:  ${result.usage.outputTokens ?? "?"}`);
  console.log(`Total tok:   ${result.usage.totalTokens ?? "?"}`);
  console.log(`Elapsed:     ${elapsed}s`);

  await mcp.close();
  console.log("\n✓ Done. MCP connection closed.\n");
}

main().catch((e) => {
  console.error("\n✗ Test failed:", e);
  process.exit(1);
});
