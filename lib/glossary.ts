// Glossary — single source of truth for crypto-native terms used across
// /docs/*. Rendered via <Gloss term="X"> as dotted-underlined inline term
// with a hover/click popover containing the definition + optional link.
//
// Add a term here once; reference it from any docs page.

export interface GlossaryEntry {
  definition: string;
  href?: string;
}

export const GLOSSARY = {
  'Sui Move': {
    definition:
      'The smart-contract language used on the Sui blockchain. Resource-oriented; objects are owned, not just referenced.',
    href: 'https://docs.sui.io/concepts/sui-move-concepts',
  },
  Walrus: {
    definition:
      "Decentralized blob storage on Sui. We use it to store the sealed prediction ciphertext and the AI judge's reasoning trace.",
    href: 'https://www.walrus.xyz',
  },
  Seal: {
    definition:
      'Identity-based encryption protocol on Sui with a threshold key-server committee. The unlock timestamp is part of the encryption identity — no key exists for that identity until the timestamp passes.',
    href: 'https://github.com/MystenLabs/seal',
  },
  MCP: {
    definition:
      'Model Context Protocol — an open standard for AI agents to discover and call external tools.',
    href: 'https://modelcontextprotocol.io',
  },
  x402: {
    definition:
      'HTTP 402 Payment Required, productized — agents pay per-call with a crypto wallet via a standard header exchange.',
    href: 'https://www.x402.org',
  },
  USDC: {
    definition:
      'USD-pegged stablecoin issued by Circle. TOLDPROOF accepts USDC on Base for x402.',
  },
  'time-lock': {
    definition:
      'Encryption scheme where the ciphertext cannot be decrypted before a specific timestamp, regardless of who holds the keys.',
  },
  SealedPrediction: {
    definition:
      'The on-chain object on Sui that holds the public receipt for one prediction — blob id, hash, unlock time, publisher, handle.',
  },
  publisher: {
    definition:
      'The Sui address that signed the seal transaction. Public on every SealedPrediction; the anchor for wallet-level reputation in V4.',
  },
  'Wilson lower bound': {
    definition:
      "Binomial confidence-interval lower bound. Converts a hit rate + sample size into a single score that's conservative for small samples.",
    href: 'https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval#Wilson_score_interval',
  },
  'Beta-binomial': {
    definition:
      'A continuous extension of the binomial distribution that handles non-integer counts. The rigorously correct way to do Wilson on difficulty-weighted hits.',
  },
  Metaculus: {
    definition:
      'Forecasting platform that uses 180-day half-life for recency decay on calibration scores. We adopted the same constant.',
    href: 'https://www.metaculus.com',
  },
  Tavily: {
    definition:
      'AI-native web search API used by the Resolution Agent to find evidence for verdicts.',
    href: 'https://tavily.com',
  },
  CoinGecko: {
    definition:
      'Crypto market-data API. Source of price-bound truth for predictions like "BTC closes above 100k".',
    href: 'https://www.coingecko.com/en/api',
  },
  PTB: {
    definition:
      'Programmable Transaction Block — Sui\'s way to chain multiple Move calls atomically in one transaction.',
  },
  IBE: {
    definition:
      'Identity-Based Encryption. Anyone can encrypt to an "identity" (e.g. a future timestamp); only the key authority can derive the decryption key.',
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryTerm = keyof typeof GLOSSARY;

export function isGlossaryTerm(s: string): s is GlossaryTerm {
  return s in GLOSSARY;
}
