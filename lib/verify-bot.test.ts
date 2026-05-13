// Unit tests for lib/verify-bot.ts — defamation-safe verdict text.
// Run: pnpm test
//
// These tests are the regression guard for the CLAUDE.md non-negotiable:
// "Never assert a claim is false. Use 'No sealed prediction found' /
//  'Absence of proof is not proof of falsehood'."
// If anyone ever introduces wording that could constitute defamation
// (e.g. "lying", "false", "fake"), the test must fail.

import { describe, it, expect } from 'vitest';
import { noProofReply, rateLimitedReply } from './verify-bot';

const DEFAMATORY_TERMS = [
  'lying',
  'liar',
  'lied',
  'false',
  'fake',
  'fraud',
  'dishonest',
  'deceiv',  // matches deceive/deceiving/deceiver
];

function assertNotDefamatory(text: string) {
  // The intentional defamation-safe disclaimer "Absence of proof is not proof
  // of falsehood" is the ONE allowed use of a defamation-adjacent word, and
  // it's allowed precisely because it negates the accusation. Strip it before
  // scanning so the substring "false" inside "falsehood" doesn't false-positive.
  const lower = text.toLowerCase().replace(/falsehood/g, '');
  for (const term of DEFAMATORY_TERMS) {
    expect(
      lower.includes(term),
      `verdict must not contain "${term}": ${text}`,
    ).toBe(false);
  }
}

describe('noProofReply', () => {
  it('mentions the handle', () => {
    const v = noProofReply('elonmusk');
    expect(v.text).toMatch(/@elonmusk/);
    expect(v.xHandle).toBe('elonmusk');
    expect(v.kind).toBe('none');
  });

  it('includes the "Absence of proof" disclaimer (defamation safety)', () => {
    const v = noProofReply('elonmusk');
    expect(v.text).toMatch(/Absence of proof is not proof of falsehood/);
  });

  it('includes a "Seal yours:" CTA', () => {
    const v = noProofReply('elonmusk');
    expect(v.text).toMatch(/Seal yours:/);
  });

  it('does NOT use defamatory wording', () => {
    const v = noProofReply('elonmusk');
    assertNotDefamatory(v.text);
  });

  it('handles weird handles without crashing', () => {
    const v = noProofReply('A_Very_Long_Username_Past_15');
    expect(v.text).toMatch(/@A_Very_Long_Username_Past_15/);
    assertNotDefamatory(v.text);
  });
});

describe('rateLimitedReply', () => {
  it('returns a rate_limited verdict', () => {
    const v = rateLimitedReply('someone');
    expect(v.kind).toBe('rate_limited');
    expect(v.xHandle).toBe('someone');
  });

  it('does NOT use defamatory wording', () => {
    const v = rateLimitedReply('someone');
    assertNotDefamatory(v.text);
  });

  it('mentions the rate limit clearly', () => {
    const v = rateLimitedReply('someone');
    expect(v.text.toLowerCase()).toMatch(/rate limit/);
  });
});
