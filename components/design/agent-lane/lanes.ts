// Lane scripts for the AI-agent-lane terminal (AgentTerminal). Each line is a
// glyph + a leading-glyph color + an ordered list of styled segments + a dwell
// (the pause AFTER the line appears, before the next). These are static demo
// values — hashes, ids, and the claim text are illustrative, not live.

export type SegKind =
  | 'plain'
  | 'dim'
  | 'ok'
  | 'pay'
  | 'amount'
  | 'seal'
  | 'code'
  | 'hash';

// Color of the leading glyph. The same arrow (←) is green for an ok response
// but amber for the 402, so glyph color can't be derived from the glyph alone.
export type GlyphColor = 'in' | 'ok' | 'pay' | 'seal' | 'muted';

export type Lane = 'agent' | 'human';

export interface Segment {
  kind: SegKind;
  text: string;
}

export interface LogLine {
  glyph: string;
  colorKey: GlyphColor;
  segments: Segment[];
  dwellMs: number;
}

// AI agents lane — the full x402 round-trip: connect → call → 402 → pay →
// settle → verified → retry → sealed.
export const AGENT_LINES: LogLine[] = [
  {
    glyph: '$',
    colorKey: 'muted',
    dwellMs: 520,
    segments: [
      { kind: 'plain', text: 'agent connects to ' },
      { kind: 'code', text: 'toldproof MCP' },
    ],
  },
  {
    glyph: '←',
    colorKey: 'ok',
    dwellMs: 720,
    segments: [
      { kind: 'ok', text: 'session open' },
      { kind: 'dim', text: ' · 5 tools available' },
    ],
  },
  {
    glyph: '→',
    colorKey: 'in',
    dwellMs: 480,
    segments: [
      { kind: 'plain', text: 'calls ' },
      { kind: 'code', text: 'seal_prediction()' },
    ],
  },
  {
    glyph: ' ',
    colorKey: 'muted',
    dwellMs: 760,
    segments: [
      { kind: 'dim', text: '"SUI flips $8 before Aug 1"  ·  unlock 2026-08-01' },
    ],
  },
  {
    glyph: '←',
    colorKey: 'pay',
    dwellMs: 880,
    segments: [
      { kind: 'pay', text: '402 Payment Required' },
      { kind: 'dim', text: ' · ' },
      { kind: 'amount', text: '$0.10 USDC' },
      { kind: 'dim', text: ' on Base' },
    ],
  },
  {
    glyph: '→',
    colorKey: 'in',
    dwellMs: 560,
    segments: [
      { kind: 'plain', text: 'pays over ' },
      { kind: 'code', text: 'x402' },
      { kind: 'dim', text: '  0.10 USDC → 0x9f…a3' },
    ],
  },
  {
    glyph: ' ',
    colorKey: 'muted',
    dwellMs: 940,
    segments: [{ kind: 'dim', text: 'settling on Base …' }],
  },
  {
    glyph: '←',
    colorKey: 'ok',
    dwellMs: 700,
    segments: [
      { kind: 'ok', text: 'payment verified' },
      { kind: 'dim', text: ' · tx ' },
      { kind: 'hash', text: '0x4c…e1' },
    ],
  },
  {
    glyph: '→',
    colorKey: 'in',
    dwellMs: 620,
    segments: [
      { kind: 'plain', text: 'retries ' },
      { kind: 'code', text: 'seal_prediction()' },
      { kind: 'dim', text: ' + receipt' },
    ],
  },
  {
    glyph: '←',
    colorKey: 'ok',
    dwellMs: 760,
    segments: [
      { kind: 'ok', text: 'sealed on Sui' },
      { kind: 'dim', text: ' · digest ' },
      { kind: 'hash', text: '0x7a…9f' },
    ],
  },
  {
    glyph: '★',
    colorKey: 'seal',
    dwellMs: 1900,
    segments: [
      { kind: 'seal', text: 'prediction #0847 locked' },
      { kind: 'dim', text: ' · opens Aug 1 2026' },
    ],
  },
];

// Humans lane — the free browser flow ending in $0.00.
export const HUMAN_LINES: LogLine[] = [
  {
    glyph: '$',
    colorKey: 'muted',
    dwellMs: 560,
    segments: [
      { kind: 'plain', text: 'connect wallet ' },
      { kind: 'dim', text: '· Sui testnet' },
    ],
  },
  {
    glyph: '←',
    colorKey: 'ok',
    dwellMs: 700,
    segments: [
      { kind: 'ok', text: 'X handle bound' },
      { kind: 'dim', text: ' · @dewaxindo' },
    ],
  },
  {
    glyph: '→',
    colorKey: 'in',
    dwellMs: 640,
    segments: [{ kind: 'plain', text: 'type the claim, pick an unlock date' }],
  },
  {
    glyph: ' ',
    colorKey: 'muted',
    dwellMs: 780,
    segments: [
      { kind: 'dim', text: 'encrypting in the browser  ' },
      { kind: 'code', text: 'AES-256' },
    ],
  },
  {
    glyph: '→',
    colorKey: 'in',
    dwellMs: 720,
    segments: [
      { kind: 'plain', text: 'ciphertext → ' },
      { kind: 'code', text: 'Walrus' },
    ],
  },
  {
    glyph: '←',
    colorKey: 'ok',
    dwellMs: 760,
    segments: [
      { kind: 'ok', text: 'sealed on Sui' },
      { kind: 'dim', text: ' · free seal 3/10 this month · ' },
      { kind: 'amount', text: '$0.00' },
    ],
  },
  {
    glyph: '★',
    colorKey: 'seal',
    dwellMs: 1900,
    segments: [
      { kind: 'seal', text: 'prediction #0846 locked' },
      { kind: 'dim', text: ' · opens Aug 1 2026' },
    ],
  },
];

export const LANE_HEAD: Record<Lane, { left: string; right: string }> = {
  agent: { left: 'agent session · mcp + x402', right: '/api/mcp/mcp' },
  human: { left: 'human session · browser', right: 'sui wallet + X oauth' },
};

export const LANE_FOOT: Record<Lane, string> = {
  agent: 'same Move contract · same receipt · paid via x402',
  human: 'same Move contract · same receipt · no payment',
};

export function linesFor(lane: Lane): LogLine[] {
  return lane === 'agent' ? AGENT_LINES : HUMAN_LINES;
}
