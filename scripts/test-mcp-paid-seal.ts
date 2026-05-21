// End-to-end x402 payment + paid MCP seal test.
//
// Two modes:
//   setup — generates a fresh Base Sepolia wallet, prints the address,
//           tells you how to faucet USDC into it. Run once.
//   seal  — connects to MCP, calls seal_prediction, catches the 402,
//           signs the EIP-3009 USDC payment with x402's
//           createPaymentHeader(), retries with the X-PAYMENT header,
//           and prints the resulting prediction ID + verify URL.
//
// This proves the full agent loop on the paid tool, end-to-end:
// AI agent decides to seal → server demands $0.10 USDC → agent pays →
// server validates via facilitator → seal lands on Sui + Walrus →
// receipt is publicly verifiable.
//
// Why this script bypasses the AI SDK MCP client: x402-mcp@0.1.1 is
// built for AI SDK v5's experimental_createMCPClient, which v6 dropped.
// We hit the MCP JSON-RPC endpoint directly with fetch — same wire
// protocol, no SDK version friction. The payment dance is identical
// either way.
//
// Run:
//   pnpm tsx --env-file=.env.local scripts/test-mcp-paid-seal.ts setup
//   pnpm tsx --env-file=.env.local scripts/test-mcp-paid-seal.ts seal "your prediction"

import { createPaymentHeader, selectPaymentRequirements } from "x402/client";
import type { PaymentRequirements } from "x402/types";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { createWalletClient, http, publicActions } from "viem";
import { baseSepolia } from "viem/chains";
import { writeFileSync, appendFileSync, existsSync } from "node:fs";

const MCP_URL =
  process.env.TOLDPROOF_MCP_URL || "https://toldproof.xyz/api/mcp/mcp";
const X402_VERSION = 1;

// ─── setup mode ──────────────────────────────────────────────────────

function setupAgentWallet() {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  console.log("\n=== AGENT WALLET GENERATED ===\n");
  console.log(`Address: ${account.address}`);
  console.log("");
  console.log("Next steps:");
  console.log("");
  console.log("1. Add this line to .env.local (do NOT commit):");
  console.log(`   AGENT_BASE_PRIVATE_KEY=${pk}`);
  console.log("");
  console.log("2. Faucet testnet USDC into the wallet:");
  console.log(
    "   https://faucet.circle.com → Base Sepolia → paste the address above",
  );
  console.log("   (You also need a tiny bit of Base Sepolia ETH for tx gas:");
  console.log("    https://www.alchemy.com/faucets/base-sepolia)");
  console.log("");
  console.log("3. Run the seal flow:");
  console.log(
    '   pnpm tsx --env-file=.env.local scripts/test-mcp-paid-seal.ts seal "BTC > 90K"',
  );
  console.log("");
  // Offer to append the line automatically
  const append = process.argv.includes("--append");
  if (append) {
    if (existsSync(".env.local")) {
      appendFileSync(".env.local", `\nAGENT_BASE_PRIVATE_KEY=${pk}\n`);
      console.log("✓ Appended AGENT_BASE_PRIVATE_KEY to .env.local");
    } else {
      writeFileSync(".env.local", `AGENT_BASE_PRIVATE_KEY=${pk}\n`);
      console.log("✓ Wrote AGENT_BASE_PRIVATE_KEY to new .env.local");
    }
  } else {
    console.log("(Re-run with --append to auto-add the line to .env.local.)");
  }
}

// ─── seal mode ───────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown;
}

// MCP server returns Server-Sent Events frames for streamable HTTP. Parse
// the first `data: ...` line as JSON to get the JSON-RPC reply.
async function readSseMessage(res: Response): Promise<unknown> {
  const text = await res.text();
  const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
  if (!dataLine)
    throw new Error(`No SSE data frame in response: ${text.slice(0, 200)}`);
  return JSON.parse(dataLine.slice("data: ".length));
}

async function callMcp(body: JsonRpcRequest): Promise<Response> {
  // x402-mcp@0.1.1 reads the payment from JSON-RPC params._meta["x402/payment"],
  // NOT from an HTTP header. The header form does nothing — see test-mcp-agent-paid.ts.
  return fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
}

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

async function sealWithPayment(predictionText: string) {
  const pk = process.env.AGENT_BASE_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) {
    console.error('AGENT_BASE_PRIVATE_KEY missing — run "setup" first.');
    process.exit(1);
  }

  const account = privateKeyToAccount(pk);
  // x402's createPaymentHeader expects a SignerWallet (WalletClient + PublicActions),
  // so we extend with publicActions() to get read-side methods on the same instance.
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  }).extend(publicActions);

  console.log(`\n🤖 Agent wallet:  ${account.address}`);
  console.log(`📡 MCP endpoint:  ${MCP_URL}`);
  console.log(`💬 Prediction:    "${predictionText}"\n`);

  // Step 1 — call seal_prediction WITHOUT payment. Expect 402.
  const unlockAtMs = Date.now() + 5 * 60 * 1000; // 5 minutes out
  const buildRequest = (paymentHeader?: string): JsonRpcRequest => ({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "seal_prediction",
      arguments: { text: predictionText, unlockAtMs },
      ...(paymentHeader ? { _meta: { "x402/payment": paymentHeader } } : {}),
    },
  });

  console.log("→ Step 1: call seal_prediction without payment…");
  let res = await callMcp(buildRequest());
  let body = (await readSseMessage(res)) as SealReply;

  if (!body.result?.isError) {
    console.log(
      "Unexpected: server accepted the call without payment. Response:",
    );
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  // The 402 challenge is JSON-encoded inside content[0].text
  const challengeText = body.result.content?.[0]?.text;
  if (!challengeText) throw new Error("No challenge body in 402 response");
  const challenge = JSON.parse(challengeText) as X402Challenge;
  console.log(
    `   ← 402: ${challenge.accepts.length} payment option(s) offered`,
  );

  // Step 2 — pick a requirement (USDC on base-sepolia) and sign the payment header.
  const requirement = selectPaymentRequirements(
    challenge.accepts,
    "base-sepolia",
    "exact",
  );
  const amount = Number(requirement.maxAmountRequired) / 1_000_000;
  console.log(`→ Step 2: sign EIP-3009 USDC payment…`);
  console.log(`   network: ${requirement.network}`);
  console.log(`   amount:  ${amount} USDC`);
  console.log(`   to:      ${requirement.payTo}`);
  console.log(`   asset:   ${requirement.asset}`);

  // REASON: x402 was built against viem ~2.13; we're on 2.48. The type
  // `SignerWallet` it imports has a slightly narrower Block.transactions
  // union, which makes our wider 2.48 type fail structural assignment.
  // Runtime is byte-compatible — both versions sign EIP-3009 identically.
  // Cast to the parameter type the package itself expects.
  const paymentHeader = await createPaymentHeader(
    walletClient as unknown as Parameters<typeof createPaymentHeader>[0],
    X402_VERSION,
    requirement,
  );
  console.log(`   ← signed (header length ${paymentHeader.length})`);

  // Step 3 — retry with payment embedded in _meta
  console.log("→ Step 3: retry seal_prediction with _meta.x402/payment…");
  res = await callMcp(buildRequest(paymentHeader));
  body = (await readSseMessage(res)) as SealReply;

  if (body.result?.isError) {
    console.error("\n✗ Server rejected the payment:");
    console.error(JSON.stringify(body.result, null, 2));
    process.exit(1);
  }

  console.log("\n✓ Seal landed on Sui!");
  const sc = body.result?.structuredContent as
    | { predictionId?: string; verifyUrl?: string }
    | undefined;
  if (sc?.predictionId) {
    console.log(`   Prediction ID: ${sc.predictionId}`);
    console.log(`   Verify URL:    ${sc.verifyUrl}`);
  } else {
    console.log("Response:");
    console.log(JSON.stringify(body.result, null, 2));
  }
}

// ─── entrypoint ──────────────────────────────────────────────────────

async function main() {
  const mode = process.argv[2];
  if (mode === "setup") {
    setupAgentWallet();
  } else if (mode === "seal") {
    const text =
      process.argv[3] ||
      `BTC will exceed $100K within 7 days (sealed at ${new Date().toISOString()})`;
    await sealWithPayment(text);
  } else {
    console.error("Usage:");
    console.error(
      "  pnpm tsx --env-file=.env.local scripts/test-mcp-paid-seal.ts setup",
    );
    console.error(
      '  pnpm tsx --env-file=.env.local scripts/test-mcp-paid-seal.ts seal "your prediction"',
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
