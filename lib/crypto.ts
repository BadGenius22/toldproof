// AES-256-GCM envelope encryption.
// Layout: [iv(12) || ciphertext || auth_tag(16)] — Web Crypto bundles tag onto ciphertext.

const IV_BYTES = 12;
const KEY_BYTES = 32;
const TAG_BYTES = 16;

// Copy a (Uint8Array | view) into a fresh ArrayBuffer-backed Uint8Array so
// it satisfies the stricter BufferSource type checking in TS 5.x.
function toArrayBuf(v: Uint8Array | ArrayBufferView): ArrayBuffer {
  const u8 = v instanceof Uint8Array ? v : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return copy.buffer;
}

export function randomAesKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(KEY_BYTES));
}

export async function aesGcmEncrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
): Promise<Uint8Array> {
  if (key.byteLength !== KEY_BYTES) {
    throw new Error(`AES key must be ${KEY_BYTES} bytes, got ${key.byteLength}`);
  }
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuf(key),
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const ctWithTag = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, toArrayBuf(plaintext)),
  );
  const out = new Uint8Array(iv.byteLength + ctWithTag.byteLength);
  out.set(iv, 0);
  out.set(ctWithTag, iv.byteLength);
  return out;
}

export async function aesGcmDecrypt(
  envelope: Uint8Array,
  key: Uint8Array,
): Promise<Uint8Array> {
  if (key.byteLength !== KEY_BYTES) {
    throw new Error(`AES key must be ${KEY_BYTES} bytes, got ${key.byteLength}`);
  }
  if (envelope.byteLength < IV_BYTES + TAG_BYTES) {
    throw new Error(`envelope too small: ${envelope.byteLength}`);
  }
  const iv = envelope.subarray(0, IV_BYTES);
  const ctWithTag = envelope.subarray(IV_BYTES);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuf(key),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuf(iv) },
      cryptoKey,
      toArrayBuf(ctWithTag),
    ),
  );
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', toArrayBuf(data)));
}
