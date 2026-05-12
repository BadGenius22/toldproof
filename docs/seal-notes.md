# Seal Time-Lock Encryption — Developer Notes

> Distilled from MystenLabs/seal docs, bootcamp `K5/seal-demo/`, and `~/.claude/skills/sui-dev/references/{10,11}*.md`. Captured Day 0.

## What we use Seal for

TOLDPROOF encrypts each prediction with a **time-locked IBE identity**. Before unlock time T, no key server will release the decryption key. At or after T, anyone with the ciphertext can decrypt.

We use **envelope encryption**: prediction is AES-GCM encrypted in the browser with a fresh 32-byte key K; the AES ciphertext goes to Walrus; only K is Seal-encrypted (gated by time) and stored on Sui. This keeps Seal payloads tiny, lets us rotate key-server providers without re-encrypting Walrus blobs, and matches the bootcamp recipe.

## The Move side: `seal_approve`

Direct lift from [`move/patterns/sources/tle.move`](https://github.com/MystenLabs/seal/blob/main/move/patterns/sources/tle.move):

```move
module toldproof::prediction_vault;

use sui::{bcs, clock::Clock};

const ENoAccess: u64 = 0;

/// Seal access policy: time-lock.
/// id = bcs::to_bytes(&unlock_at_ms)
entry fun seal_approve(id: vector<u8>, c: &Clock) {
    let mut prepared = bcs::new(id);
    let unlock_time = prepared.peel_u64();
    let leftover = prepared.into_remainder_bytes();
    assert!(leftover.length() == 0 && c.timestamp_ms() >= unlock_time, ENoAccess);
}
```

### Mandatory conventions (from the skill)

1. **Function name MUST start with `seal_approve`** (the key server matches on prefix; `seal_approve`, `seal_approve_v2`, `seal_approve_with_nft` all valid).
2. **First parameter MUST be `id: vector<u8>`** — raw policy bytes, **without** the package-ID prefix (key server adds it).
3. **`entry` (NOT `public entry`)** — only `entry`. `public entry` lets other packages compose the function and bypass the dry-run isolation.
4. **Abort to deny, return to approve.** No `Option`, no return value — just `assert!` or pass-through.
5. **Side-effect free.** It's run via `dry_run_transaction_block`; state changes are discarded. Don't mint, transfer, or emit.
6. **No fast-changing state.** Eventual consistency across key servers means different servers may see different state. Stick to `Clock` and immutable/slowly-changing shared objects.
7. **`ctx.sender()` = session-key signer**, not the dApp address.

## Envelope encryption flow (Toldproof's pattern)

### Seal time (browser)

```ts
import { SealClient } from '@mysten/seal';
import { WalrusClient } from '@mysten/walrus';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { fromHex } from '@mysten/sui/utils';

const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

const seal = new SealClient({
  suiClient,
  serverConfigs: [
    { objectId: '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75', weight: 1 },
    { objectId: '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8', weight: 1 },
  ],
  verifyKeyServers: true,  // true on startup; switch to false for hot paths
});

const walrus = new WalrusClient({ network: 'testnet', suiClient });

// 1. Local AES-GCM
const aesKey = crypto.getRandomValues(new Uint8Array(32));
const iv     = crypto.getRandomValues(new Uint8Array(12));
const aesKeyImported = await crypto.subtle.importKey(
  'raw', aesKey, { name: 'AES-GCM' }, false, ['encrypt'],
);
const plaintext   = new TextEncoder().encode('BTC > 85k by 2026-06-30');
const ciphertext  = new Uint8Array(await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv }, aesKeyImported, plaintext,
));
const stored = new Uint8Array(iv.length + ciphertext.length);
stored.set(iv, 0); stored.set(ciphertext, iv.length);

const contentHash = new Uint8Array(await crypto.subtle.digest('SHA-256', plaintext));

// 2. Walrus stores the AES ciphertext
const { blobId } = await walrus.writeBlob({
  blob: stored, signer, epochs: 60, deletable: false,
});

// 3. Seal encrypts ONLY the 32-byte AES key, identity = bcs(unlockMs)
const unlockMs = BigInt(Date.parse('2026-06-30T00:00:00Z'));
const id = bcs.u64().serialize(unlockMs).toBytes();

const { encryptedObject: sealedKey } = await seal.encrypt({
  threshold: 2,
  packageId: fromHex(TOLDPROOF_PACKAGE_ID),
  id,
  data: aesKey,
});
// `backupKey` from encrypt() is intentionally NOT used — we want Seal-only access.

// 4. Record on Sui: prediction_vault::seal_prediction(reg, x_handle, unlock, content_hash, blob_id, sealed_key, &clock)
```

### Reveal time (cron watcher)

```ts
import { SessionKey } from '@mysten/seal';

// 1. Session key — cron's keypair signs once per 5 min cycle
const sessionKey = await SessionKey.create({
  address: cronKeypair.getPublicKey().toSuiAddress(),
  packageId: fromHex(TOLDPROOF_PACKAGE_ID),
  ttlMin: 5,
  signer: cronKeypair,
  suiClient,
});

// 2. PTB calling seal_approve(id, clock) — key server dry-runs this
const tx = new Transaction();
tx.moveCall({
  target: `${TOLDPROOF_PACKAGE_ID}::prediction_vault::seal_approve`,
  arguments: [tx.pure.vector('u8', Array.from(id)), tx.object.clock()],
});
const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

// 3. Seal returns the AES key (or refuses if clock < unlock)
const aesKey = await seal.decrypt({ data: sealedKey, sessionKey, txBytes });

// 4. Fetch Walrus blob, AES-decrypt locally
const blob = await walrus.readBlob({ blobId });
const iv = blob.slice(0, 12);
const ct = blob.slice(12);
const key = await crypto.subtle.importKey('raw', aesKey, { name: 'AES-GCM' }, false, ['decrypt']);
const plaintext = new Uint8Array(
  await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct),
);

// 5. Commit reveal on-chain: prediction_vault::reveal(reg, prediction, plaintext, &clock)
```

If `clock < unlock` the key server refuses — `seal_approve` aborts in dry-run, no key is returned.

## Key server configuration (testnet)

Skill recommends **2-of-2 with the two Mysten-operated committee members**. Pure cryptographic threshold; no aggregator-trust hop.

| Provider | Object ID |
|----------|-----------|
| Mysten Labs 1 | `0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75` |
| Mysten Labs 2 | `0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8` |

For production-grade fault tolerance, swap to **2-of-3** with one of:

| Provider | Object ID |
|----------|-----------|
| Ruby Nodes | `0x6068c0acb197dddbacd4746a9de7f025b2ed5a5b6c1b1ab44dade4426d141da2` |
| NodeInfra | `0x5466b7df5c15b508678d51496ada8afab0d6f70a01c10613123382b1b8131007` |
| Studio Mirai | `0x164ac3d2b3b8694b8181c13f671950004765c23f270321a45fdd04d40cccf0f2` |
| Overclock | `0x9c949e53c36ab7a9c484ed9e8b43267a77d4b8d70e79aa6b39042e3d4c434105` |

**The set of key servers is fixed at encryption time.** We cannot swap providers for existing ciphertexts. Envelope encryption mitigates this: rotating providers means re-encrypting only the 32-byte AES key, never the Walrus payload.

## Seal protocol package IDs (informational)

The SDK picks these by network — we don't normally set them.

| Network | Seal Package ID |
|---------|----------------|
| Testnet | `0x927a54e9ae803f82ebf480136a9bcfe45101ccbe28b13f433c89f5181069d682` |
| Mainnet | `0xa212c4c6c7183b911d0be8768f4cb1df7a383025b5d0ba0c014009f0f30f5f8d` |

## Security non-negotiables

- **Never log `backupKey`, session key signatures, or AES keys.** Redact in any structured logging (CLAUDE.md).
- **Discard `encrypt()` backupKey** — we want Seal-only access. Anyone holding both the backup key and the Walrus blob bypasses the time-lock.
- **The reveal cron's keypair is sensitive** — it can decrypt anything past unlock. Store in Vercel encrypted env, rotate periodically.
- **Application-level audit log only.** Seal key servers don't emit on-chain logs of key delivery; we anchor reveal events on Sui ourselves via `PredictionRevealed`.
- **`seal_approve` MUST have positive + negative tests** before mainnet (CLAUDE.md). Test that approval works AFTER unlock and aborts BEFORE.
- **Walrus blobs are permanent.** "Delete" = remove from on-chain index. State this in the privacy policy.

## Testnet IDs we use

- Walrus testnet system object: `0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af`
- Sui testnet RPC: `https://fullnode.testnet.sui.io:443`
- Seal key servers: see table above

## References

- [tle.move (canonical pattern)](https://github.com/MystenLabs/seal/blob/main/move/patterns/sources/tle.move)
- [Seal Design](https://seal-docs.wal.app/Design) / [UsingSeal](https://seal-docs.wal.app/UsingSeal) / [ExamplePatterns](https://seal-docs.wal.app/ExamplePatterns) / [SecurityBestPractices](https://seal-docs.wal.app/SecurityBestPractices)
- [Walrus docs](https://docs.wal.app)
- `~/.claude/skills/sui-dev/references/10-seal.md` and `11-toldproof-stack.md`
- Bootcamp `K5/seal-demo/` — closest end-to-end reference
