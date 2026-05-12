# Seal Time-Lock Encryption — Developer Notes

> Distilled from MystenLabs/seal docs and the canonical [`move/patterns/sources/tle.move`](https://github.com/MystenLabs/seal/blob/main/move/patterns/sources/tle.move) reference. Captured Day 0.

## What we use Seal for

TOLDPROOF encrypts each prediction with a **time-locked IBE identity**. Before unlock time T, no key server will release the decryption key. At or after T, anyone with the ciphertext can decrypt.

The ciphertext lives on Walrus (immutable, public). The prediction is private until T and trivially verifiable after.

## The Move side: `seal_approve`

Direct lift from `move/patterns/sources/tle.move`:

```move
module toldproof::prediction_vault;

use sui::{bcs::{Self, BCS}, clock};

const ENoAccess: u64 = 77;

/// Key id format: [pkg_id][bcs::to_bytes(unlock_ms)]
fun check_policy(id: vector<u8>, c: &clock::Clock): bool {
    let mut prepared: BCS = bcs::new(id);
    let t = prepared.peel_u64();
    let leftovers = prepared.into_remainder_bytes();
    (leftovers.length() == 0) && (c.timestamp_ms() >= t)
}

entry fun seal_approve(id: vector<u8>, c: &clock::Clock) {
    assert!(check_policy(id, c), ENoAccess);
}
```

**Notes:**
- The Seal key server strips the leading `[pkg_id]` before calling `seal_approve`, so `id` inside the function is just `bcs::to_bytes(unlock_ms)` — the trailing 8 bytes representing the u64 unlock timestamp.
- `peel_u64` consumes those 8 bytes. `leftovers.length() == 0` asserts the caller didn't append junk.
- `clock::Clock` is the shared `0x6` Clock object; `clock.timestamp_ms()` is monotonic.
- Must be `entry fun` (not `public fun`) for the key server to call it via PTB.
- The function name MUST start with `seal_approve` (the key server matches on this prefix). Multiple `seal_approve*` functions can coexist.

## The TypeScript side: `@mysten/seal`

### Encrypt at seal time

```ts
import { SealClient, SessionKey } from '@mysten/seal';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { fromHEX } from '@mysten/sui/utils';
import { bcs } from '@mysten/sui/bcs';

const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

const sealClient = new SealClient({
  suiClient,
  serverConfigs: [
    // Decentralized aggregator (Mysten-operated) — fine for dev, single-server trust:
    {
      objectId: '0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98',
      aggregatorUrl: 'https://seal-aggregator-testnet.mystenlabs.com',
      weight: 1,
    },
    // Independent committee members — adds fault tolerance:
    { objectId: '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75', weight: 1 },
    { objectId: '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8', weight: 1 },
  ],
  verifyKeyServers: false, // skip extra RTTs unless we need to validate
});

// Identity = bcs::to_bytes(unlock_ms) — the key server prepends [pkg_id] itself.
const unlockMs = BigInt(Date.parse('2026-06-30T00:00:00Z'));
const idBytes = bcs.u64().serialize(unlockMs).toBytes();
const idHex = Buffer.from(idBytes).toString('hex');

const plaintext = new TextEncoder().encode('BTC > 85k by 2026-06-30');

const { encryptedObject, key: backupKey } = await sealClient.encrypt({
  threshold: 2,          // need 2 of the 3 servers above
  packageId: fromHEX(TOLDPROOF_PKG_ID),
  id: fromHEX(idHex),
  data: plaintext,
});

// `encryptedObject` is the ciphertext that goes to Walrus.
// `backupKey` is the AES key — if we keep it we can decrypt without Seal.
// MVP plan: discard backupKey (only Seal-mediated reveals).
```

### Decrypt at reveal time (in the cron watcher)

```ts
import { Transaction } from '@mysten/sui/transactions';

// 1. Build a transaction that calls seal_approve(id, clock).
const tx = new Transaction();
tx.moveCall({
  target: `${TOLDPROOF_PKG_ID}::prediction_vault::seal_approve`,
  arguments: [
    tx.pure.vector('u8', fromHEX(idHex)),
    tx.object('0x6'),                       // Sui's shared Clock
  ],
});
const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

// 2. Session key — proves the caller controls a Sui address, signed personally.
const sessionKey = await SessionKey.create({
  address: walletAddress,
  packageId: fromHEX(TOLDPROOF_PKG_ID),
  ttlMin: 10,
  suiClient,
});
const sig = await keypair.signPersonalMessage(sessionKey.getPersonalMessage());
sessionKey.setPersonalMessageSignature(sig.signature);

// 3. Fetch the key + decrypt.
const plaintext = await sealClient.decrypt({
  data: encryptedObject,
  sessionKey,
  txBytes,
});
```

If the clock check fails (`now < unlock_ms`), the key server refuses — `seal_approve` aborts in PTB dry-run, no key is returned.

## Key server configuration choices

| Mode | Servers | Threshold | When to use |
|------|---------|-----------|-------------|
| Decentralized (Mysten aggregator) | 1 | 1 | Local dev only — trusts Mysten |
| Independent committee | N | M-of-N | Production — set in our SealClient |
| Hybrid | mix | match | What we use: 3 servers, threshold=2 |

Threshold 2-of-3 on testnet gives fault tolerance against one server outage while not adding much latency. For mainnet we keep the same; per Seal docs the threshold is a per-call parameter on `encrypt()`.

## Security non-negotiables (from CLAUDE.md + Seal docs)

- **Never log `backupKey` or any session key signature.** Redact in any structured logging.
- **Never log the Seal session key personal message signature** (it lets anyone impersonate the user for `ttlMin`).
- **Discard `backupKey`** after encryption unless we explicitly want a recovery path. If we keep it for the user, we must encrypt it under their wallet and never store plaintext.
- **Application-level audit log only.** Seal key servers don't emit on-chain logs of key delivery; we anchor reveal events on Sui ourselves via `PredictionRevealed`.
- **`seal_approve` must be tested with at least one positive (after unlock) and one negative (before unlock) case** before mainnet (per CLAUDE.md).

## What about Walrus?

Walrus is dumb storage: store ciphertext, get `blob_id`. The Sui Move object stores the `blob_id` reference + the `unlock_at_ms` + a commitment hash. Walrus blobs are **permanent** — never write code that assumes deletion (CLAUDE.md non-negotiable).

For TOLDPROOF, encrypted prediction size is tiny (a tweet — say <1 KB after framing). Walrus testnet `walrus info` shows ~73,408 FROST metadata cost + ~1,184 FROST/epoch storage — so even 10-year storage on a tweet-sized blob is < 0.005 WAL.

## Testnet IDs we use

- Walrus testnet system object: `0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af`
- Walrus testnet RPC: `https://fullnode.testnet.sui.io:443`
- Seal aggregator testnet: `https://seal-aggregator-testnet.mystenlabs.com`
- Seal aggregator key server (testnet): `0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98`
- Independent key servers (testnet): see `lib/seal.ts` once written.

## References

- [tle.move (canonical pattern)](https://github.com/MystenLabs/seal/blob/main/move/patterns/sources/tle.move)
- [Seal Design](https://seal-docs.wal.app/Design)
- [Seal UsingSeal](https://seal-docs.wal.app/UsingSeal)
- [Seal ExamplePatterns](https://seal-docs.wal.app/ExamplePatterns)
- [Seal SecurityBestPractices](https://seal-docs.wal.app/SecurityBestPractices)
- [Walrus docs](https://docs.wal.app)
