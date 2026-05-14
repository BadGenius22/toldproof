// Unit tests for lib/mcp-helpers.ts — pure helpers used by the MCP route.
// These exercise the paid-tool's pre-seal logic (payer extraction, alias
// derivation upstream) and the format functions returned by every read tool.

import { describe, it, expect } from 'vitest';
import {
  asMcpStructured,
  extractPayerAddress,
  formatPredictionShort,
  formatPredictionView,
} from './mcp-helpers';
import type { PredictionView } from './registry';

// Build a valid x402 payment envelope: base64(JSON({ payload: { authorization: { from }}}))
function encodeX402Payment(from: string): string {
  const payload = { payload: { authorization: { from } } };
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
}

const BASE_VIEW: PredictionView = {
  id: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
  publisher: '0xpub',
  identity: 'dewaxindo',
  entityType: 0,
  sealedAtMs: Date.UTC(2026, 4, 1, 12, 0, 0),
  unlockAtMs: Date.UTC(2026, 5, 1, 12, 0, 0),
  revealed: false,
  revealedAtMs: 0,
  revealedPlaintext: '',
  blobId: 'walrus-blob-id-123',
  contentHashHex: 'deadbeef',
  resolved: false,
  hit: false,
  resolvedAtMs: 0,
  reasoningBlobId: '',
  resolver: '',
};

describe('extractPayerAddress', () => {
  it('returns sentinel "0x0" when input is not a string', () => {
    expect(extractPayerAddress(undefined)).toBe('0x0');
    expect(extractPayerAddress(null)).toBe('0x0');
    expect(extractPayerAddress(42)).toBe('0x0');
    expect(extractPayerAddress({ payment: 'x' })).toBe('0x0');
  });

  it('returns "0x0" on malformed base64', () => {
    expect(extractPayerAddress('not-valid-base64!@#$%^&')).toBe('0x0');
  });

  it('returns "0x0" when the decoded payload is not a JSON object', () => {
    const garbage = Buffer.from('not-json', 'utf-8').toString('base64');
    expect(extractPayerAddress(garbage)).toBe('0x0');
  });

  it('returns "0x0" when payload.authorization is missing', () => {
    const envelope = Buffer.from(JSON.stringify({ payload: {} }), 'utf-8').toString(
      'base64',
    );
    expect(extractPayerAddress(envelope)).toBe('0x0');
  });

  it('returns "0x0" when authorization.from is missing', () => {
    const envelope = Buffer.from(
      JSON.stringify({ payload: { authorization: {} } }),
      'utf-8',
    ).toString('base64');
    expect(extractPayerAddress(envelope)).toBe('0x0');
  });

  it('returns the payer address from a well-formed x402 payment envelope', () => {
    const payer = '0x1234567890abcdef1234567890abcdef12345678';
    expect(extractPayerAddress(encodeX402Payment(payer))).toBe(payer);
  });

  it('tolerates extra fields in the payment envelope', () => {
    const payer = '0xabcd';
    const envelope = Buffer.from(
      JSON.stringify({
        payload: {
          authorization: { from: payer, to: '0xrecipient', amount: '100000' },
          signature: 'sig...',
        },
        scheme: 'exact',
        network: 'base-sepolia',
      }),
      'utf-8',
    ).toString('base64');
    expect(extractPayerAddress(envelope)).toBe(payer);
  });
});

describe('asMcpStructured', () => {
  it('is identity-equivalent (round-trips the value reference)', () => {
    const input = { foo: 'bar', n: 42 };
    expect(asMcpStructured(input)).toBe(input);
  });

  it('accepts any shape and returns a Record-typed value', () => {
    expect(asMcpStructured(null)).toBe(null);
    const arr = [1, 2, 3];
    expect(asMcpStructured(arr)).toBe(arr);
  });
});

describe('formatPredictionView', () => {
  it('shows the human emoji for entity_type=0', () => {
    const out = formatPredictionView(BASE_VIEW);
    expect(out).toContain('👤 dewaxindo');
    expect(out).not.toContain('🤖');
  });

  it('shows the AI agent emoji for entity_type=1', () => {
    const out = formatPredictionView({
      ...BASE_VIEW,
      entityType: 1,
      identity: 'agent-foo',
    });
    expect(out).toContain('🤖 agent-foo');
    expect(out).not.toContain('👤');
  });

  it('reports SEALED when not yet revealed', () => {
    const out = formatPredictionView(BASE_VIEW);
    expect(out).toContain('Status: SEALED');
    expect(out).toContain('Plaintext: <sealed>');
  });

  it('reports REVEALED · awaiting AI resolution when revealed but not resolved', () => {
    const out = formatPredictionView({
      ...BASE_VIEW,
      revealed: true,
      revealedPlaintext: 'BTC > 95k by 2026-06-30',
    });
    expect(out).toContain('Status: REVEALED · awaiting AI resolution');
    expect(out).toContain('Plaintext: "BTC > 95k by 2026-06-30"');
  });

  it('reports RESOLVED · HIT ✓ when resolved and hit=true', () => {
    const out = formatPredictionView({
      ...BASE_VIEW,
      revealed: true,
      resolved: true,
      hit: true,
      revealedPlaintext: 'They called it',
    });
    expect(out).toContain('Status: RESOLVED · HIT ✓');
  });

  it('reports RESOLVED · MISS ✗ when resolved and hit=false', () => {
    const out = formatPredictionView({
      ...BASE_VIEW,
      revealed: true,
      resolved: true,
      hit: false,
      revealedPlaintext: 'They didn’t',
    });
    expect(out).toContain('Status: RESOLVED · MISS ✗');
  });

  it('omits the reasoning-trace line when reasoningBlobId is empty', () => {
    const out = formatPredictionView({
      ...BASE_VIEW,
      revealed: true,
      resolved: true,
      hit: true,
      reasoningBlobId: '',
    });
    expect(out).not.toContain('AI reasoning trace:');
  });

  it('includes the reasoning-trace line when resolved && reasoningBlobId is truthy', () => {
    const out = formatPredictionView({
      ...BASE_VIEW,
      revealed: true,
      resolved: true,
      hit: true,
      reasoningBlobId: 'walrus-trace-id-abc',
    });
    expect(out).toContain('AI reasoning trace: walrus blob walrus-trace-id-abc');
  });

  it('always emits the publisher address', () => {
    const out = formatPredictionView({ ...BASE_VIEW, publisher: '0xPUBLISHER' });
    expect(out).toContain('Publisher: 0xPUBLISHER');
  });

  it('produces newline-separated output that any LLM can read', () => {
    const out = formatPredictionView(BASE_VIEW);
    const lines = out.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(5);
    expect(lines[0]).toMatch(/^(?:👤|🤖) /u);
  });
});

describe('formatPredictionShort', () => {
  it('shows 🔒 sealed when neither revealed nor resolved', () => {
    expect(formatPredictionShort(BASE_VIEW)).toContain('🔒 sealed');
  });

  it('shows ⊙ revealed when revealed but not resolved', () => {
    const out = formatPredictionShort({ ...BASE_VIEW, revealed: true });
    expect(out).toContain('⊙ revealed');
  });

  it('shows ✓ HIT when resolved and hit', () => {
    const out = formatPredictionShort({
      ...BASE_VIEW,
      revealed: true,
      resolved: true,
      hit: true,
    });
    expect(out).toContain('✓ HIT');
  });

  it('shows ✗ MISS when resolved and not hit', () => {
    const out = formatPredictionShort({
      ...BASE_VIEW,
      revealed: true,
      resolved: true,
      hit: false,
    });
    expect(out).toContain('✗ MISS');
  });

  it('truncates the prediction id with an ellipsis', () => {
    const out = formatPredictionShort(BASE_VIEW);
    // First 10 chars of "0xa1b2c3d4e5f6..." → "0xa1b2c3d4"
    expect(out).toContain('0xa1b2c3d4');
    expect(out).toContain('…');
  });

  it('includes only the YYYY-MM-DD slice of the unlock date', () => {
    const out = formatPredictionShort(BASE_VIEW);
    expect(out).toContain('unlocks 2026-06-01');
    // Should not include the time portion.
    expect(out).not.toContain('T12:00:00');
  });
});
