// Unit tests for lib/walrus.ts — epochsForUnlock pure function.
// Run: pnpm test
//
// storeBlob/readBlob are integration code (hit Walrus HTTP endpoints),
// not unit-tested here.

import { describe, it, expect } from 'vitest';
import { epochsForUnlock, WALRUS_MAX_EPOCHS } from './walrus';

const DAY_MS = 86_400_000;

describe('epochsForUnlock (testnet — 1 day per epoch)', () => {
  const now = 1_700_000_000_000; // fixed reference instant

  it('returns the 10-epoch floor for sub-day unlocks', () => {
    expect(epochsForUnlock(now + 5 * 60_000, now)).toBe(10);   // +5m
    expect(epochsForUnlock(now + 60 * 60_000, now)).toBe(10);  // +1h
    expect(epochsForUnlock(now + DAY_MS, now)).toBe(10);       // +1d (1 + 7 buffer = 8, floor 10)
  });

  it('adds 7-day buffer to multi-day unlocks', () => {
    expect(epochsForUnlock(now + 7 * DAY_MS, now)).toBe(14);   // 7 + 7
    expect(epochsForUnlock(now + 30 * DAY_MS, now)).toBe(37);  // 30 + 7
  });

  it('hits the cap exactly at 46 days (53 - 7 buffer)', () => {
    expect(epochsForUnlock(now + 45 * DAY_MS, now)).toBe(52);
    expect(epochsForUnlock(now + 46 * DAY_MS, now)).toBe(WALRUS_MAX_EPOCHS); // 46 + 7 = 53
  });

  it('throws when unlock is beyond the testnet horizon', () => {
    expect(() => epochsForUnlock(now + 60 * DAY_MS, now)).toThrow(/too far out/);
    expect(() => epochsForUnlock(now + 365 * DAY_MS, now)).toThrow(/too far out/);
  });

  it('throws when unlock is in the past or now', () => {
    expect(() => epochsForUnlock(now - 1, now)).toThrow(/in the future/);
    expect(() => epochsForUnlock(now, now)).toThrow(/in the future/);
  });

  it('error message mentions the day cap and the mainnet alternative', () => {
    try {
      epochsForUnlock(now + 1000 * DAY_MS, now);
      throw new Error('should have thrown');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).toMatch(/\d+ days/);
      expect(msg).toMatch(/mainnet/);
    }
  });
});
