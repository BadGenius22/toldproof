// Single source of truth for /docs sidebar ordering, badges, and sub-sections.
// Used by DocsShell (sidebar), DocsToc (right-rail context), and the redesigned
// /docs index page (numbered cards).

export interface DocsNavSub {
  slug: string;
  title: string;
}

export interface DocsNavItem {
  ix: string;
  slug: string;
  title: string;
  badge?: string;
  blurb: string;
  subs: DocsNavSub[];
  // Bottom-meta key stat for the index card. Format: "label · value".
  stat?: string;
}

export const DOCS_NAV: DocsNavItem[] = [
  {
    ix: '01',
    slug: 'architecture',
    title: 'Architecture',
    badge: '7 steps',
    blurb:
      'The end-to-end flow — wallet or MCP, Sui contract, Walrus storage, Seal time-lock, and the AI judge that opens it.',
    subs: [
      { slug: 'step-by-step', title: 'Step by step' },
      { slug: 'the-system-diagram', title: 'The system diagram' },
      { slug: 'primitives', title: 'Primitives — Sui · Walrus · Seal · crons' },
    ],
    stat: '7 steps · Sui + Walrus + Seal',
  },
  {
    ix: '02',
    slug: 'move-contract',
    title: 'Move contract',
    badge: '62 tests',
    blurb:
      'The on-chain receipt. Three seal paths, three roles, first-claim-wins identity locks.',
    subs: [
      { slug: 'three-seal-paths', title: 'Three seal paths' },
      { slug: 'three-roles-on-registry', title: 'Three roles on Registry' },
      { slug: 'the-seal_approve-function', title: 'The seal_approve function' },
    ],
    stat: '62 / 62 tests · audited v3',
  },
  {
    ix: '03',
    slug: 'mcp',
    title: 'MCP integration',
    badge: '5 tools',
    blurb:
      'Any MCP-compatible agent can seal a Sui-verified prediction in one tool call. $0.10 USDC via x402 on Base. No signup.',
    subs: [
      { slug: 'endpoint', title: 'Endpoint' },
      { slug: 'the-five-tools', title: 'The five tools' },
      { slug: 'payment-flow-x402', title: 'Payment flow (x402)' },
    ],
    stat: '1 paid + 4 free · x402 on Base',
  },
  {
    ix: '04',
    slug: 'resolution',
    title: 'Resolution Agent',
    badge: 'multi-model',
    blurb:
      'At unlock time, the AI judge reads the plaintext, runs a tool-use loop, and stamps a hit-or-miss verdict on Sui — reasoning anchored to Walrus.',
    subs: [
      { slug: 'the-tool-use-loop', title: 'The tool-use loop (6 steps)' },
      { slug: 'two-modes', title: 'Two modes — single & consensus' },
      { slug: 'cadence', title: 'Cron cadence' },
    ],
    stat: 'Claude + GPT + Gemini + critic',
  },
  {
    ix: '05',
    slug: 'audit',
    title: 'Audit',
    badge: 'v3 cleared',
    blurb:
      'Three rounds of /dewaxguard audits. v3 cleared the new paid path: 0 / 0 / 0 / 0 / 3.',
    subs: [
      { slug: 'current-head-v3', title: 'Current head · v3' },
      { slug: 'audit-history', title: 'Audit history (v1 → v2 → v3)' },
      { slug: 'what-the-audit-looked-for', title: 'What the audit looked for' },
    ],
    stat: '0 / 0 / 0 / 0 / 3 (Cr/H/M/L/Info)',
  },
];

// Reference group — methodology footnotes that aren't peer pages.
// Rendered as a second sidebar section under "Reference" eyebrow.
export const DOCS_REFERENCE: DocsNavItem[] = [
  {
    ix: 'R1',
    slug: 'skill-score',
    title: 'Skill score math',
    badge: 'methodology',
    blurb:
      'How we rank humans and AI agents on calibration. Wilson lower bound on difficulty-weighted hits, recency decay, wallet aggregation.',
    subs: [
      { slug: 'the-formula', title: '01 · The formula' },
      { slug: 'difficulty-weight', title: '02 · Difficulty weight' },
      { slug: 'recency-weight', title: '03 · Recency & decay curve' },
      { slug: 'eligibility-gate', title: '04 · Eligibility gate' },
      { slug: 'wallet-aggregation', title: '05 · Wallet aggregation' },
      { slug: 'frequently-asked', title: '06 · Frequently asked' },
      { slug: 'why-wilson', title: '07 · Why Wilson, not hit-rate?' },
    ],
    stat: 'wilson + decay + wallet aggregate',
  },
];

export function findNavItem(slug: string): DocsNavItem | undefined {
  return [...DOCS_NAV, ...DOCS_REFERENCE].find((n) => n.slug === slug);
}

export function getPrevNext(slug: string): {
  prev: DocsNavItem | null;
  next: DocsNavItem | null;
} {
  // Prev/next only flows through the main DOCS_NAV (5 main pages).
  // Reference pages are peers, not part of the linear flow.
  const i = DOCS_NAV.findIndex((n) => n.slug === slug);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? DOCS_NAV[i - 1]! : null,
    next: i < DOCS_NAV.length - 1 ? DOCS_NAV[i + 1]! : null,
  };
}
