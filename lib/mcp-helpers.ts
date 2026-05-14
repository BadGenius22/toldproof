// Pure helpers used by the MCP route (app/api/mcp/[transport]/route.ts).
// Lifted out of the route file so they're unit-testable without spinning up
// the MCP framework. Each function is intentionally pure — no I/O, no module
// state — so tests can call them directly with mock inputs.

import type { PredictionView } from './registry';

// Decode the x402 payer EVM address from MCP payment metadata. x402-mcp
// doesn't surface the payer directly to the tool callback, but the payment
// payload is a base64-encoded JSON envelope that carries `payload.authorization.from`.
// Returns the sentinel `'0x0'` on any decode/shape failure so callers can
// treat "unknown payer" as a uniform case.
export function extractPayerAddress(payment: unknown): string {
  if (typeof payment !== 'string') return '0x0';
  try {
    const decoded = JSON.parse(
      Buffer.from(payment, 'base64').toString('utf-8'),
    ) as { payload?: { authorization?: { from?: string } } };
    return decoded.payload?.authorization?.from ?? '0x0';
  } catch {
    return '0x0';
  }
}

// MCP's tool-result `structuredContent` field has the type
// `{ [x: string]: unknown }` (a plain record). Our typed interfaces (like
// PredictionView, ServerSealOutput) don't have an index signature, so direct
// assignment fails. JSON round-tripping is identical, so this cast is safe.
export function asMcpStructured<T>(v: T): Record<string, unknown> {
  return v as unknown as Record<string, unknown>;
}

// Long-form prediction summary returned by the `get_prediction` MCP tool.
export function formatPredictionView(p: PredictionView): string {
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

// Compact list row used by the `list_predictions` MCP tool.
export function formatPredictionShort(p: PredictionView): string {
  const status = p.resolved
    ? p.hit
      ? '✓ HIT'
      : '✗ MISS'
    : p.revealed
      ? '⊙ revealed'
      : '🔒 sealed';
  return `  ${status} · ${p.id.slice(0, 10)}… · unlocks ${new Date(p.unlockAtMs).toISOString().slice(0, 10)}`;
}
