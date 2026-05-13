// Unit tests for lib/crypto.ts — AES-GCM envelope + sha256.
// Run: pnpm test

import { describe, it, expect } from 'vitest';
import { aesGcmDecrypt, aesGcmEncrypt, randomAesKey, sha256 } from './crypto';

describe('randomAesKey', () => {
  it('returns 32 bytes', () => {
    const k = randomAesKey();
    expect(k.byteLength).toBe(32);
  });

  it('returns different bytes on each call (entropy)', () => {
    const a = randomAesKey();
    const b = randomAesKey();
    // Effectively zero chance of collision on 256-bit random.
    expect(Buffer.from(a).toString('hex')).not.toBe(Buffer.from(b).toString('hex'));
  });
});

describe('aesGcmEncrypt + aesGcmDecrypt', () => {
  it('round-trips plaintext', async () => {
    const key = randomAesKey();
    const plaintext = new TextEncoder().encode('toldproof unit test 🔒');
    const env = await aesGcmEncrypt(plaintext, key);
    const out = await aesGcmDecrypt(env, key);
    expect(new TextDecoder().decode(out)).toBe('toldproof unit test 🔒');
  });

  it('produces different envelopes for the same plaintext (random IV)', async () => {
    const key = randomAesKey();
    const plaintext = new TextEncoder().encode('same plaintext');
    const e1 = await aesGcmEncrypt(plaintext, key);
    const e2 = await aesGcmEncrypt(plaintext, key);
    expect(Buffer.from(e1).toString('hex')).not.toBe(Buffer.from(e2).toString('hex'));
  });

  it('envelope layout is [iv(12) || ciphertext || tag(16)]', async () => {
    const key = randomAesKey();
    const plaintext = new Uint8Array(0); // empty plaintext
    const env = await aesGcmEncrypt(plaintext, key);
    // 12 (iv) + 0 (ciphertext) + 16 (auth tag) = 28
    expect(env.byteLength).toBe(28);
  });

  it('decrypt with wrong key fails (auth tag)', async () => {
    const k1 = randomAesKey();
    const k2 = randomAesKey();
    const env = await aesGcmEncrypt(new TextEncoder().encode('secret'), k1);
    await expect(aesGcmDecrypt(env, k2)).rejects.toThrow();
  });

  it('decrypt with tampered ciphertext fails (auth tag)', async () => {
    const key = randomAesKey();
    const env = await aesGcmEncrypt(new TextEncoder().encode('secret'), key);
    // Flip a bit in the body (skip IV).
    const tampered = new Uint8Array(env);
    tampered[20] ^= 0x01;
    await expect(aesGcmDecrypt(tampered, key)).rejects.toThrow();
  });

  it('rejects key with wrong length', async () => {
    const shortKey = new Uint8Array(16); // AES-128 key — we require AES-256
    const plaintext = new TextEncoder().encode('x');
    await expect(aesGcmEncrypt(plaintext, shortKey)).rejects.toThrow(/32 bytes/);
  });

  it('rejects envelope smaller than iv+tag', async () => {
    const key = randomAesKey();
    const tooSmall = new Uint8Array(20); // < 12 + 16 = 28
    await expect(aesGcmDecrypt(tooSmall, key)).rejects.toThrow(/envelope too small/);
  });
});

describe('sha256', () => {
  it('matches known vector for empty input', async () => {
    // Well-known: sha256(b"") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    const out = await sha256(new Uint8Array(0));
    expect(Buffer.from(out).toString('hex')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('matches known vector for "abc"', async () => {
    // Well-known: sha256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    const out = await sha256(new TextEncoder().encode('abc'));
    expect(Buffer.from(out).toString('hex')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('always returns 32 bytes', async () => {
    const out = await sha256(new TextEncoder().encode('any length input'));
    expect(out.byteLength).toBe(32);
  });
});
