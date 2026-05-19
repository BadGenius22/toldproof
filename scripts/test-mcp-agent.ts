// End-to-end MCP test as an AI agent would consume it.
//
// Demonstrates the full agent integration loop:
//   1. Connect to TOLDPROOF MCP server via streamable HTTP
//   2. Discover the tool catalog
//   3. Hand the tools to Claude via Vercel AI Gateway
//   4. Prompt the AI in natural language
//   5. Watch the AI choose tools, call them, and write a summary
//
// This is the "AI agency" test — proves an LLM can actually USE the MCP
// server unprompted, not just that the protocol layer works.
//
// Free tools (get_leaderboard, list_predictions, get_prediction) work
// out-of-the-box. The paid seal_prediction tool returns 402 and would
// need an x402 wallet adapter on the agent side to complete the dance.
// For this test we only exercise the free tools.
//
// Run:
//   pnpm tsx --env-file=.env.local scripts/test-mcp-agent.ts
//   pnpm tsx --env-file=.env.local scripts/test-mcp-agent.ts "your prompt"
//
// Needs AI_GATEWAY_API_KEY in .env.local (already set if /api/cron/resolve
// works locally). Costs roughly $0.01 per run.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { generateText, stepCountIs, tool, type ToolSet } from 'ai';
import { jsonSchema } from 'ai';

const MCP_URL =
  process.env.TOLDPROOF_MCP_URL || 'https://toldproof.xyz/api/mcp/mcp';
const MODEL = process.env.MCP_TEST_MODEL || 'anthropic/claude-sonnet-4.5';
const DEFAULT_PROMPT =
  'Look up the TOLDPROOF leaderboard. Tell me who is at the top, what their hit rate is, ' +
  'and any standout predictions in their recent history. If they have a low Skill Score ' +
  "despite a high hit rate, explain why — using TOLDPROOF's difficulty axis.";

async function main() {
  const userPrompt = process.argv[2] || DEFAULT_PROMPT;

  console.log(`\n🔌 Connecting to ${MCP_URL}…`);
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  const mcp = new Client({ name: 'toldproof-mcp-test', version: '1.0.0' });
  await mcp.connect(transport);

  // List tools the server exposes
  const { tools: mcpTools } = await mcp.listTools();
  console.log(`✓ Connected. ${mcpTools.length} tools available:`);
  for (const t of mcpTools) {
    const paid = (t.annotations as { paymentHint?: boolean } | undefined)?.paymentHint;
    console.log(`    ${paid ? '💰' : '🆓'} ${t.name}`);
  }

  // Bridge MCP tools → AI SDK tools. AI SDK calls our handler when the
  // model emits a tool call; the handler dispatches to MCP and returns
  // the result back to the model loop.
  const aiTools: ToolSet = {};
  for (const t of mcpTools) {
    aiTools[t.name] = tool({
      description: t.description ?? `MCP tool ${t.name}`,
      inputSchema: jsonSchema(t.inputSchema as Record<string, unknown>),
      execute: async (args: unknown) => {
        const res = await mcp.callTool({
          name: t.name,
          arguments: args as Record<string, unknown>,
        });
        if (res.isError) {
          return { error: true, content: res.content };
        }
        // Most MCP tools return a structuredContent payload for programmatic
        // consumers; fall back to the plain text content otherwise.
        return res.structuredContent ?? res.content;
      },
    });
  }

  console.log(`\n💬 Prompt: "${userPrompt}"\n`);
  console.log(`🤖 Running ${MODEL} with ${Object.keys(aiTools).length} MCP tools…\n`);

  const startedAt = Date.now();
  const result = await generateText({
    model: MODEL,
    tools: aiTools,
    // Stop after 5 steps or when the model produces no more tool calls.
    stopWhen: stepCountIs(5),
    prompt: userPrompt,
  });

  // Print each step so the demo recording captures the tool-call flow
  console.log('═══ STEP-BY-STEP TRACE ═══');
  result.steps.forEach((step, i) => {
    const toolNames = (step.toolCalls ?? [])
      .map((c) => (c as { toolName: string }).toolName)
      .join(', ');
    console.log(
      `\n[Step ${i + 1}]${toolNames ? ` 🔧 ${toolNames}` : ' 💭 reasoning only'}`,
    );
    if (step.text) {
      console.log(`   text: ${step.text.slice(0, 200)}${step.text.length > 200 ? '…' : ''}`);
    }
    (step.toolCalls ?? []).forEach((tc) => {
      const call = tc as { toolName: string; input?: unknown };
      const inp = JSON.stringify(call.input).slice(0, 100);
      console.log(`   ↳ args: ${inp}${inp.length === 100 ? '…' : ''}`);
    });
  });

  console.log('\n═══ FINAL ANSWER ═══\n');
  console.log(result.text);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('\n═══ USAGE ═══');
  console.log(`Steps:       ${result.steps.length}`);
  console.log(`Input tok:   ${result.usage.inputTokens ?? '?'}`);
  console.log(`Output tok:  ${result.usage.outputTokens ?? '?'}`);
  console.log(`Total tok:   ${result.usage.totalTokens ?? '?'}`);
  console.log(`Elapsed:     ${elapsed}s`);
  console.log(`Approx cost: ~$${(((result.usage.totalTokens ?? 0) * 0.000005) | 0) || '0.00'}`);

  await mcp.close();
  console.log('\n✓ Done. MCP connection closed.\n');
}

main().catch((e) => {
  console.error('\n✗ Test failed:', e);
  process.exit(1);
});
