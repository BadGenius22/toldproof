// Tools the Resolution Agent calls to gather evidence before producing a verdict.
//
// Every tool call + its result is captured in the AI SDK `result.steps` trace,
// then serialized into the reasoning-trace JSON we store on Walrus. That trace
// IS the auditable artifact subscribers see — when they click "View reasoning
// trace" on a /verify page, they're reading exactly the queries this agent ran
// and the data it observed.
//
// Tools are designed to fail gracefully — if Tavily key is missing or CoinGecko
// rate-limits, the tool returns an error object the agent can incorporate
// ("no web search available; reasoning from training data") rather than throwing.

import { tool } from 'ai';
import { z } from 'zod';
import {
  TavilyResponseSchema,
  CoinGeckoSimplePriceSchema,
  CoinGeckoMarketChartSchema,
} from './schemas';

// ─── Tavily web search ────────────────────────────────────────────────

export const webSearchTool = tool({
  description:
    'Search the web for current information about an event, claim, price, ' +
    'or factual question. Use this to verify or refute predictions about ' +
    'public events. Returns a list of recent web results with snippets + URLs. ' +
    'Each URL in your sources MUST come from a result you actually saw here.',
  inputSchema: z.object({
    query: z
      .string()
      .min(3)
      .describe(
        'Specific search query. Be precise: include token tickers, date ranges, ' +
          'and the exact claim words rather than vague paraphrasing. ' +
          'Example good query: "ETH market cap above SOL May 2026". ' +
          'Example bad query: "ethereum news".',
      ),
    maxResults: z
      .number()
      .min(1)
      .max(8)
      .default(5)
      .describe('Max results to return. Use 3 for narrow questions, 5-8 for broad ones.'),
  }),
  execute: async ({ query, maxResults }) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        error:
          'TAVILY_API_KEY not configured. Cannot search the web. Reason about the ' +
          'prediction from your training data only; set confidence below 0.5 if ' +
          'you cannot verify it.',
        results: [],
      };
    }
    try {
      const resp = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'advanced',
          max_results: maxResults,
          include_answer: true,
        }),
      });
      if (!resp.ok) {
        return {
          ok: false,
          error: `Tavily ${resp.status}: ${await resp.text().catch(() => 'unknown')}`,
          results: [],
        };
      }
      const parsed = TavilyResponseSchema.safeParse(await resp.json());
      if (!parsed.success) {
        return {
          ok: false,
          error: `Tavily returned unexpected response shape: ${parsed.error.message}`,
          results: [],
        };
      }
      const data = parsed.data;
      return {
        ok: true,
        query: data.query,
        answer: data.answer ?? null,
        results: data.results.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
          published: r.published_date ?? null,
          score: r.score,
        })),
      };
    } catch (e: unknown) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        results: [],
      };
    }
  },
});

// ─── CoinGecko price lookups (free tier, no auth) ─────────────────────

// Common token symbols → CoinGecko IDs. The agent can also pass a CoinGecko ID
// directly (e.g. "ethereum") if it knows one not in this map.
const TOKEN_ID_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  SUI: 'sui',
  WAL: 'walrus-2',
  USDC: 'usd-coin',
  USDT: 'tether',
  AVAX: 'avalanche-2',
  ARB: 'arbitrum',
  OP: 'optimism',
  MATIC: 'matic-network',
  ADA: 'cardano',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  LINK: 'chainlink',
  ATOM: 'cosmos',
  NEAR: 'near',
  APT: 'aptos',
  TIA: 'celestia',
  TON: 'the-open-network',
  HYPE: 'hyperliquid',
  PUMP: 'pump-fun',
};

function resolveTokenId(input: string): string {
  const upper = input.trim().toUpperCase();
  if (TOKEN_ID_MAP[upper]) return TOKEN_ID_MAP[upper];
  // Assume the user passed a raw CoinGecko ID (lowercase, e.g. "celestia")
  return input.trim().toLowerCase();
}

export const tokenPriceTool = tool({
  description:
    'Get the current USD price, market cap, and 24h change for a crypto token. ' +
    'Useful when a prediction makes a price claim (e.g. "BTC above $100k"). ' +
    'Pass the ticker (BTC, ETH, SOL, SUI, WAL, etc.) or the CoinGecko ID. ' +
    'For comparisons like "ETH market cap above SOL", call this once per token.',
  inputSchema: z.object({
    symbolOrId: z
      .string()
      .describe('Ticker (BTC, ETH, SOL, …) or CoinGecko ID (e.g. "ethereum")'),
  }),
  execute: async ({ symbolOrId }) => {
    const id = resolveTokenId(symbolOrId);
    try {
      const url = new URL('https://api.coingecko.com/api/v3/simple/price');
      url.searchParams.set('ids', id);
      url.searchParams.set('vs_currencies', 'usd');
      url.searchParams.set('include_market_cap', 'true');
      url.searchParams.set('include_24hr_change', 'true');
      url.searchParams.set('include_last_updated_at', 'true');
      const resp = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) {
        return { ok: false, error: `CoinGecko ${resp.status}`, id };
      }
      const parsed = CoinGeckoSimplePriceSchema.safeParse(await resp.json());
      if (!parsed.success) {
        return {
          ok: false,
          error: `CoinGecko returned unexpected response shape: ${parsed.error.message}`,
          id,
        };
      }
      const entry = parsed.data[id];
      if (!entry) {
        return {
          ok: false,
          error: `No CoinGecko data for "${id}" (resolved from "${symbolOrId}"). Try a different ticker.`,
          id,
        };
      }
      return {
        ok: true,
        id,
        symbol: symbolOrId.toUpperCase(),
        priceUsd: entry.usd,
        marketCapUsd: entry.usd_market_cap ?? null,
        change24hPct: entry.usd_24h_change ?? null,
        lastUpdatedAt: entry.last_updated_at
          ? new Date(entry.last_updated_at * 1000).toISOString()
          : null,
      };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e), id };
    }
  },
});

export const priceHistoryTool = tool({
  description:
    'Get historical price + market cap for a token over the past N days. ' +
    'Use this when a prediction has a time-bounded claim (e.g. "ETH > $5k by ' +
    'June 30"). Returns daily samples plus high/low/start/end summary.',
  inputSchema: z.object({
    symbolOrId: z.string().describe('Ticker or CoinGecko ID'),
    days: z
      .number()
      .min(1)
      .max(365)
      .describe(
        'Number of days back from today. CoinGecko returns hourly granularity ' +
          'for ≤90 days and daily for longer. Cap is 365 on the free tier.',
      ),
  }),
  execute: async ({ symbolOrId, days }) => {
    const id = resolveTokenId(symbolOrId);
    try {
      const url = new URL(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart`,
      );
      url.searchParams.set('vs_currency', 'usd');
      url.searchParams.set('days', String(days));
      const resp = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) {
        return { ok: false, error: `CoinGecko ${resp.status}`, id };
      }
      const parsed = CoinGeckoMarketChartSchema.safeParse(await resp.json());
      if (!parsed.success) {
        return {
          ok: false,
          error: `CoinGecko returned unexpected response shape: ${parsed.error.message}`,
          id,
        };
      }
      const prices = parsed.data.prices;
      if (!prices.length) {
        return { ok: false, error: 'no price data', id };
      }
      // Summarize: agent doesn't need all 8K data points
      const values = prices.map((p) => p[1]);
      const high = Math.max(...values);
      const low = Math.min(...values);
      const start = prices[0]!;
      const end = prices[prices.length - 1]!;
      // Sample 8 evenly-spaced points so the agent can see the shape
      const samples = [];
      const step = Math.max(1, Math.floor(prices.length / 8));
      for (let i = 0; i < prices.length; i += step) {
        samples.push({
          date: new Date(prices[i]![0]).toISOString().slice(0, 10),
          priceUsd: prices[i]![1],
        });
      }
      return {
        ok: true,
        id,
        symbol: symbolOrId.toUpperCase(),
        days,
        start: { date: new Date(start[0]).toISOString().slice(0, 10), priceUsd: start[1] },
        end: { date: new Date(end[0]).toISOString().slice(0, 10), priceUsd: end[1] },
        high,
        low,
        samples,
        totalPoints: prices.length,
      };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e), id };
    }
  },
});

// ─── Final verdict tool ───────────────────────────────────────────────

// The agent MUST call submitVerdict once it has enough evidence. We extract
// its arguments as the canonical verdict and stop the loop.
export const VerdictSchema = z.object({
  hit: z
    .boolean()
    .describe('true if the prediction came true by the current date, false if it was wrong'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('0..1 — how sure you are. Use <0.5 if evidence is sparse or contradictory.'),
  reasoning: z
    .string()
    .min(30)
    .describe(
      'Plain-English explanation, 3-6 sentences. Cite specific facts and numbers from ' +
        'tool results. Never assert the author is dishonest — only state whether the ' +
        'predicted outcome matches reality.',
    ),
  sources: z
    .array(z.string())
    .describe(
      'URLs from web_search results AND/OR tool names (e.g. "coingecko:ethereum") ' +
        'you used to reach this verdict. Must be non-empty unless reasoning purely ' +
        'from training data — in which case explicitly note that in `caveats`.',
    ),
  caveats: z
    .string()
    .optional()
    .describe(
      'Optional 1-2 sentence note on ambiguity, definitions, or sparse evidence. ' +
        'Use when the verdict depends on interpretation.',
    ),
});

export type Verdict = z.infer<typeof VerdictSchema>;

export const submitVerdictTool = tool({
  description:
    'Submit your final verdict. Call this LAST, once you have gathered enough ' +
    'evidence via the other tools. Once you call this, you MUST NOT call any ' +
    'further tools — the agent loop stops here.',
  inputSchema: VerdictSchema,
  execute: async (verdict) => {
    // Pass-through — we extract the args from the tool call in the parent.
    return verdict;
  },
});

// ─── Bundle export ────────────────────────────────────────────────────

export const RESOLUTION_AGENT_TOOLS = {
  web_search: webSearchTool,
  get_token_price: tokenPriceTool,
  get_price_history: priceHistoryTool,
  submit_verdict: submitVerdictTool,
};
