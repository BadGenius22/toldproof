// Unit tests for lib/mcp-seal.ts — agent-alias derivation only.
// `executeServerSeal` is integration-only (Sui + Seal + Walrus mocks) and lives
// in a separate test file when those mocks are wired up.

import { describe, it, expect } from 'vitest';
import { defaultMcpAgentAlias } from './mcp-seal';
import { defaultAgentAlias } from './sui';

describe('defaultMcpAgentAlias', () => {
  it('prefixes with "agent-evm-"', () => {
    expect(defaultMcpAgentAlias('0xdeadbeef00000000000000000000000000000000')).toMatch(
      /^agent-evm-/,
    );
  });

  it('takes the first 8 hex chars after the 0x prefix', () => {
    expect(
      defaultMcpAgentAlias('0xdeadbeef00000000000000000000000000000000'),
    ).toBe('agent-evm-deadbeef');
  });

  it('lowercases the address slice', () => {
    expect(
      defaultMcpAgentAlias('0xDEADBEEF00000000000000000000000000000000'),
    ).toBe('agent-evm-deadbeef');
  });

  it('strips the 0x prefix before slicing', () => {
    // Without 0x, "deadbeef..." has the same first 8 chars
    expect(defaultMcpAgentAlias('deadbeef00000000')).toBe('agent-evm-deadbeef');
  });

  it('produces a stable alias for the same address (deterministic)', () => {
    const a = defaultMcpAgentAlias('0xabcd1234abcd1234abcd1234abcd1234abcd1234');
    const b = defaultMcpAgentAlias('0xabcd1234abcd1234abcd1234abcd1234abcd1234');
    expect(a).toBe(b);
  });

  it('produces different aliases for addresses that differ in the first 8 chars', () => {
    const a = defaultMcpAgentAlias('0xaaaaaaaa00000000000000000000000000000000');
    const b = defaultMcpAgentAlias('0xbbbbbbbb00000000000000000000000000000000');
    expect(a).not.toBe(b);
  });

  it('collides for addresses that share the first 8 chars after 0x', () => {
    // KNOWN PROPERTY of the v1 alias scheme: only the leading 8 hex chars matter.
    // Collisions in production would require an EVM address-bound dynamic field
    // on-chain (see lib/mcp-seal.ts comment on ServerSealInput.payerAddress).
    const a = defaultMcpAgentAlias('0xdeadbeefAA000000000000000000000000000000');
    const b = defaultMcpAgentAlias('0xdeadbeefBB000000000000000000000000000000');
    expect(a).toBe(b);
  });

  it('handles short or empty input without throwing', () => {
    expect(() => defaultMcpAgentAlias('')).not.toThrow();
    expect(() => defaultMcpAgentAlias('0x')).not.toThrow();
    expect(defaultMcpAgentAlias('')).toBe('agent-evm-');
    expect(defaultMcpAgentAlias('0x')).toBe('agent-evm-');
  });
});

describe('defaultAgentAlias (Sui-side)', () => {
  it('prefixes with "agent-" (no -evm- segment)', () => {
    expect(defaultAgentAlias('0xabcdef0123456789abcdef0123456789abcdef01')).toMatch(
      /^agent-/,
    );
    // Make sure it's the Sui variant, not the EVM one
    expect(
      defaultAgentAlias('0xabcdef0123456789abcdef0123456789abcdef01'),
    ).not.toContain('evm');
  });

  it('takes the first 8 hex chars after the 0x prefix, lowercase', () => {
    expect(
      defaultAgentAlias('0xABCDEF0123456789abcdef0123456789abcdef01'),
    ).toBe('agent-abcdef01');
  });

  it('is deterministic for the same wallet address', () => {
    const addr = '0x1234567890abcdef1234567890abcdef12345678';
    expect(defaultAgentAlias(addr)).toBe(defaultAgentAlias(addr));
  });
});
