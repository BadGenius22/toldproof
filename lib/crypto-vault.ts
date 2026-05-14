// Symmetric encryption for OAuth tokens at rest.
//
// AES-256-GCM with a per-deployment key (TOLDPROOF_OAUTH_KEY, 32 bytes base64url).
// We embed the IV and auth tag in the stored ciphertext so the consumer only
// needs to know the key to decrypt. Format: base64url(iv || tag || ciphertext).
//
// Why not libsodium sealed box: this is symmetric secret-to-self storage; we
// don't need asymmetric keys. Node's built-in crypto avoids a dep, runs in the
// Node.js runtime, and is well-audited.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm' as const;
const IV_LEN = 12; // GCM standard nonce size
const TAG_LEN = 16;

function loadKey(): Buffer {
  const raw = process.env.TOLDPROOF_OAUTH_KEY;
  if (!raw) {
    throw new Error(
      'TOLDPROOF_OAUTH_KEY is not set. Generate with: ' +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`,
    );
  }
  // base64url decode; node accepts 'base64url' since 16.x.
  const key = Buffer.from(raw, 'base64url');
  if (key.length !== 32) {
    throw new Error(
      `TOLDPROOF_OAUTH_KEY must decode to 32 bytes (got ${key.length}). Regenerate with the one-liner above.`,
    );
  }
  return key;
}

/**
 * Encrypts a UTF-8 string. Returns base64url(iv || tag || ciphertext).
 * The same input encrypted twice produces different output (random IV).
 */
export function encryptToken(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64url');
}

/**
 * Decrypts a value produced by encryptToken. Throws if the tag fails to
 * authenticate (tamper, wrong key, truncation).
 */
export function decryptToken(encoded: string): string {
  const key = loadKey();
  const blob = Buffer.from(encoded, 'base64url');
  if (blob.length < IV_LEN + TAG_LEN) {
    throw new Error('Ciphertext is too short to contain IV + tag.');
  }
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = blob.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
