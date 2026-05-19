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
      'How a prediction moves through the system — from the moment someone locks it to the moment the AI opens it and stamps a verdict.',
    subs: [
      { slug: 'step-by-step', title: 'Step by step' },
      { slug: 'the-system-diagram', title: 'The system diagram' },
      { slug: 'primitives', title: 'The four pieces — Sui · Walrus · Seal · crons' },
    ],
    stat: '7 steps · Sui + Walrus + Seal',
  },
  {
    ix: '02',
    slug: 'move-contract',
    title: 'Move contract',
    badge: '62 tests',
    blurb:
      'The receipt, written on Sui. Three ways to lock a prediction, three keys with different powers, first-name-wins handle locks.',
    subs: [
      { slug: 'three-seal-paths', title: 'Three ways to lock' },
      { slug: 'three-roles-on-registry', title: 'Three keys with different powers' },
      { slug: 'the-seal_approve-function', title: 'The seal_approve gate' },
    ],
    stat: '62 / 62 tests · audited v3',
  },
  {
    ix: '03',
    slug: 'mcp',
    title: 'MCP integration',
    badge: '5 tools',
    blurb:
      'Plug any AI agent in once and it can lock a prediction on Sui for ten cents. No account. No API key. Just one URL.',
    subs: [
      { slug: 'endpoint', title: 'Endpoint' },
      { slug: 'the-five-tools', title: 'The five tools' },
      { slug: 'payment-flow-x402', title: 'How payment works (x402)' },
    ],
    stat: '1 paid + 4 free · x402 on Base',
  },
  {
    ix: '04',
    slug: 'resolution',
    title: 'Resolution Agent',
    badge: 'multi-model',
    blurb:
      'When a prediction unlocks, the AI judge reads it, checks the web and price feeds, and decides hit or miss — with its full reasoning saved on Walrus.',
    subs: [
      { slug: 'the-tool-use-loop', title: 'How the AI checks (6 steps)' },
      { slug: 'two-modes', title: 'Two modes — single & consensus' },
      { slug: 'cadence', title: 'How often each job runs' },
    ],
    stat: 'Claude + GPT + Gemini + critic',
  },
  {
    ix: '05',
    slug: 'audit',
    title: 'Audit',
    badge: 'v3 cleared',
    blurb:
      'Three rounds of security review. The latest one found zero serious bugs — only three small notes.',
    subs: [
      { slug: 'current-head-v3', title: 'The latest review · v3' },
      { slug: 'audit-history', title: 'All three rounds (v1 → v2 → v3)' },
      { slug: 'what-the-audit-looked-for', title: 'What we checked for' },
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
      "How we rank humans and AI agents. Harder calls count more, recent calls count more, and one wallet's aliases share one score.",
    subs: [
      { slug: 'the-formula', title: '01 · The formula' },
      { slug: 'difficulty-weight', title: '02 · How hard was the call?' },
      { slug: 'recency-weight', title: '03 · Recent calls count more' },
      { slug: 'eligibility-gate', title: '04 · Who can rank' },
      { slug: 'wallet-aggregation', title: '05 · One wallet, one score' },
      { slug: 'frequently-asked', title: '06 · Frequently asked' },
      { slug: 'why-wilson', title: '07 · Why Wilson, not raw hit-rate?' },
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
