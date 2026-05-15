// GET /api/seal/price-hint?text=...
//
// Lightweight helper used by the lock form to nudge users away from
// already-true predictions. Given the prediction text:
//   1. Detect known crypto tickers (BTC, ETH, SOL, SUI, etc.)
//   2. Detect a threshold ("> 80K", "above $5000", etc.)
//   3. Fetch the current USD price from CoinGecko
//   4. Decide whether the call appears already true at this moment
//
// Response is intentionally tolerant — if we can't confidently detect the
// shape, we return ok: true with no hint. The UI hides itself in that case.
//
// This is a UX hint, not a validation rule. Users can still lock anything.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Tickers we recognize in the lock form. Mirror agent-tools.ts but kept local
// so this endpoint doesn't pull in the full AI tool surface.
const TICKER_TO_COINGECKO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  SUI: 'sui',
  WAL: 'walrus-2',
  USDC: 'usd-coin',
  USDT: 'tether',
  AVAX: 'avalanche-2',
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

interface Hint {
  ticker: string;
  currentPriceUsd: number;
  threshold?: number;
  direction?: 'above' | 'below';
  alreadyTrue?: boolean;
  // Plain-English one-liner the UI displays under the textarea.
  message: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const text = (searchParams.get('text') ?? '').trim();

  if (text.length < 3) {
    return NextResponse.json({ ok: true, hints: [] });
  }

  // 1) Detect tickers — word-boundary match so "BITCOIN" doesn't match "BTC".
  const detected = new Set<string>();
  for (const [tk] of Object.entries(TICKER_TO_COINGECKO_ID)) {
    const re = new RegExp(`\\b${tk}\\b`, 'i');
    if (re.test(text)) detected.add(tk);
  }
  if (detected.size === 0) {
    return NextResponse.json({ ok: true, hints: [] });
  }

  // 2) Fetch prices for the detected tickers.
  const ids = Array.from(detected).map((tk) => TICKER_TO_COINGECKO_ID[tk]).join(',');
  let prices: Record<string, { usd: number }> = {};
  try {
    const url = new URL('https://api.coingecko.com/api/v3/simple/price');
    url.searchParams.set('ids', ids);
    url.searchParams.set('vs_currencies', 'usd');
    const resp = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      // CoinGecko free tier — short cache to avoid hammering on every keystroke.
      next: { revalidate: 30 },
    });
    if (!resp.ok) {
      // Surface no hint rather than an error — the UI is best-effort.
      return NextResponse.json({ ok: true, hints: [] });
    }
    prices = (await resp.json()) as typeof prices;
  } catch {
    return NextResponse.json({ ok: true, hints: [] });
  }

  // 3) For each ticker, try to find a threshold + direction nearby.
  const hints: Hint[] = [];
  for (const ticker of detected) {
    const cgId = TICKER_TO_COINGECKO_ID[ticker];
    const price = prices[cgId]?.usd;
    if (!price) continue;

    const tk = parseThresholdNear(text, ticker);
    if (!tk) {
      // Ticker mentioned but no threshold detected — show plain info.
      hints.push({
        ticker,
        currentPriceUsd: price,
        message: `${formatTicker(ticker)} is at ${formatUsd(price)} right now.`,
      });
      continue;
    }

    const alreadyTrue =
      (tk.direction === 'above' && price > tk.value) ||
      (tk.direction === 'below' && price < tk.value);

    let message: string;
    if (alreadyTrue) {
      message =
        `Heads up: ${formatTicker(ticker)} is at ${formatUsd(price)} right now, ` +
        `so "${formatTicker(ticker)} ${tk.direction} ${formatUsd(tk.value)}" is already true. ` +
        `Strong receipts come from calls that could still go either way before they open.`;
    } else {
      const delta = Math.abs(price - tk.value);
      const pctMove = ((delta / price) * 100).toFixed(1);
      message =
        `${formatTicker(ticker)} is at ${formatUsd(price)} right now — your call needs a ` +
        `${pctMove}% move ${tk.direction === 'above' ? 'up' : 'down'} to ${formatUsd(tk.value)}.`;
    }

    hints.push({
      ticker,
      currentPriceUsd: price,
      threshold: tk.value,
      direction: tk.direction,
      alreadyTrue,
      message,
    });
  }

  return NextResponse.json({ ok: true, hints });
}

// Pulls a number + direction word near the ticker. Matches forms like:
//   "BTC > 80K", "BTC above $80,000", "BTC under 95k", "BTC < 5000"
function parseThresholdNear(
  text: string,
  ticker: string,
): { value: number; direction: 'above' | 'below' } | null {
  // Window of ~40 chars around the ticker — predictions are short.
  const re = new RegExp(`\\b${ticker}\\b([^]{0,40})`, 'i');
  const m = text.match(re);
  if (!m) return null;
  const window = m[1];

  // Direction detection.
  let direction: 'above' | 'below' | null = null;
  if (/>|above|over|higher than|greater than|exceeds?|reach(?:es|ed)?|hit(?:s)?\b/i.test(window)) {
    direction = 'above';
  } else if (/<|below|under|lower than|less than|drops? (?:to|below)|crash(?:es|ed)? to/i.test(window)) {
    direction = 'below';
  }
  if (!direction) return null;

  // Number detection: $123,456.78  or  80K  or  1.2M  or  5000
  const numMatch = window.match(/\$?\s*(\d+(?:[,.\d]*)?)\s*([kKmMbB])?/);
  if (!numMatch) return null;
  const raw = numMatch[1].replace(/,/g, '');
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return null;
  const suffix = numMatch[2]?.toUpperCase();
  let scaled = value;
  if (suffix === 'K') scaled *= 1_000;
  else if (suffix === 'M') scaled *= 1_000_000;
  else if (suffix === 'B') scaled *= 1_000_000_000;

  return { value: scaled, direction };
}

function formatTicker(t: string): string {
  return t.toUpperCase();
}

function formatUsd(n: number): string {
  if (n >= 1_000) {
    return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 4 })}`;
}
