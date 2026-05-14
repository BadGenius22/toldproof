// Unit tests for lib/schemas.ts — runtime validation at every I/O boundary.
// Coverage focus: the v1↔v2 contract-shape permissiveness (the leaderboard
// crash from earlier in the session was caused by a missing fallback here),
// external HTTP-response schemas (Tavily, CoinGecko), and the Walrus blob-id
// format check.

import { describe, it, expect } from 'vitest';
import {
  SealedPredictionFieldsSchema,
  RegistryFieldsSchema,
  IdentityPredictionListSchema,
  PredictionResolvedEventSchema,
  ReputationProfileUpdatedEventSchema,
  PredictionRevealSliceSchema,
  PredictionResolveSliceSchema,
  TavilyResponseSchema,
  CoinGeckoSimplePriceSchema,
  CoinGeckoMarketChartSchema,
  assertValidWalrusBlobId,
} from './schemas';

// ──────────────────────────────────────────────────────────────────────
// SealedPredictionFieldsSchema — must accept BOTH the live testnet (v1)
// and the source-of-truth v2/v3 shape. If this regresses, the leaderboard,
// verify page, and registry helpers all break against the live contract.

describe('SealedPredictionFieldsSchema — v2/v3 shape', () => {
  it('parses a fully-populated v2 SealedPrediction', () => {
    const raw = {
      publisher: '0xpub',
      identity: 'dewaxindo',
      entity_type: 0,
      sealed_at_ms: '1747000000000',
      unlock_at_ms: '1748000000000',
      content_hash: [1, 2, 3],
      blob_id: 'walrus-base64-id',
      sealed_key: [4, 5, 6],
      revealed: true,
      revealed_at_ms: '1748000001000',
      revealed_plaintext: [104, 105],
      resolved: true,
      hit: true,
      resolved_at_ms: '1748000002000',
      reasoning_blob_id: 'walrus-trace',
      resolver: '0xresolver',
    };
    const parsed = SealedPredictionFieldsSchema.parse(raw);
    expect(parsed.identity).toBe('dewaxindo');
    expect(parsed.entity_type).toBe(0);
    expect(parsed.resolved).toBe(true);
    expect(parsed.hit).toBe(true);
  });

  it('parses a v2 SealedPrediction with no resolution fields yet', () => {
    const raw = {
      publisher: '0xpub',
      identity: 'agent-foo',
      entity_type: 1,
      sealed_at_ms: '1',
      unlock_at_ms: '2',
      content_hash: [],
      blob_id: '',
      sealed_key: [],
      revealed: false,
      revealed_at_ms: '0',
      revealed_plaintext: [],
    };
    const parsed = SealedPredictionFieldsSchema.parse(raw);
    expect(parsed.entity_type).toBe(1);
    expect(parsed.resolved).toBeUndefined();
  });
});

describe('SealedPredictionFieldsSchema — v1 backwards-compat', () => {
  it('accepts the v1 shape with x_handle (not identity) and no entity_type', () => {
    const raw = {
      publisher: '0xpub',
      x_handle: 'crypto_oracle_9000', // v1 field name
      sealed_at_ms: '1',
      unlock_at_ms: '2',
      content_hash: [],
      blob_id: '',
      sealed_key: [],
      revealed: false,
      revealed_at_ms: '0',
      revealed_plaintext: [],
      // no entity_type, no resolution fields
    };
    const parsed = SealedPredictionFieldsSchema.parse(raw);
    // Transform normalizes x_handle into identity for downstream consumers.
    expect(parsed.identity).toBe('crypto_oracle_9000');
    // v1 predictions are always human → entity_type defaults to 0.
    expect(parsed.entity_type).toBe(0);
  });

  it('rejects an object that has neither identity nor x_handle', () => {
    const raw = {
      publisher: '0xpub',
      sealed_at_ms: '1',
      unlock_at_ms: '2',
      content_hash: [],
      blob_id: '',
      sealed_key: [],
      revealed: false,
      revealed_at_ms: '0',
      revealed_plaintext: [],
    };
    expect(() => SealedPredictionFieldsSchema.parse(raw)).toThrow(
      /neither identity nor x_handle/,
    );
  });

  it('prefers identity over x_handle when both are present', () => {
    const raw = {
      publisher: '0xpub',
      identity: 'new-name', // v2
      x_handle: 'old-name', // v1 (should be ignored)
      sealed_at_ms: '1',
      unlock_at_ms: '2',
      content_hash: [],
      blob_id: '',
      sealed_key: [],
      revealed: false,
      revealed_at_ms: '0',
      revealed_plaintext: [],
    };
    const parsed = SealedPredictionFieldsSchema.parse(raw);
    expect(parsed.identity).toBe('new-name');
  });
});

// ──────────────────────────────────────────────────────────────────────
// Registry shape — same v1↔v2 fallback for the lookup-table field rename.

describe('RegistryFieldsSchema', () => {
  const tableHandle = {
    fields: {
      id: { id: '0xtable-id' },
      size: '0',
    },
  };

  it('parses the v2 shape with by_identity', () => {
    const raw = { by_identity: tableHandle };
    const parsed = RegistryFieldsSchema.parse(raw);
    expect(parsed.by_identity?.fields.id.id).toBe('0xtable-id');
  });

  it('parses the v1 shape with by_handle', () => {
    const raw = { by_handle: tableHandle };
    const parsed = RegistryFieldsSchema.parse(raw);
    expect(parsed.by_handle?.fields.id.id).toBe('0xtable-id');
  });

  it('parses when both are present (registry helper picks identity)', () => {
    const raw = {
      by_identity: tableHandle,
      by_handle: { fields: { id: { id: '0xold-id' }, size: '99' } },
    };
    const parsed = RegistryFieldsSchema.parse(raw);
    expect(parsed.by_identity?.fields.id.id).toBe('0xtable-id');
    expect(parsed.by_handle?.fields.id.id).toBe('0xold-id');
  });

  it('rejects an object missing both lookup tables', () => {
    expect(() => RegistryFieldsSchema.parse({ total_count: '0' })).toThrow(
      /neither by_identity nor by_handle/,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────
// Dynamic-field and event schemas

describe('IdentityPredictionListSchema', () => {
  it('parses a dynamic-field value with an array of prediction IDs', () => {
    const raw = { value: ['0xpred-1', '0xpred-2'] };
    expect(IdentityPredictionListSchema.parse(raw).value).toEqual([
      '0xpred-1',
      '0xpred-2',
    ]);
  });

  it('rejects a missing value array', () => {
    expect(() => IdentityPredictionListSchema.parse({})).toThrow();
  });
});

describe('PredictionResolvedEventSchema', () => {
  it('parses the minimal event shape', () => {
    expect(
      PredictionResolvedEventSchema.parse({ prediction_id: '0xpred' }).prediction_id,
    ).toBe('0xpred');
  });
});

describe('ReputationProfileUpdatedEventSchema', () => {
  it('parses with profile_blob_id as a byte array', () => {
    const parsed = ReputationProfileUpdatedEventSchema.parse({
      identity: 'foo',
      profile_blob_id: [1, 2, 3],
      version: '1',
    });
    expect(parsed.identity).toBe('foo');
    expect(parsed.version).toBe('1');
  });

  it('parses with profile_blob_id as a base64 string (alternate RPC shape)', () => {
    const parsed = ReputationProfileUpdatedEventSchema.parse({
      identity: 'foo',
      profile_blob_id: 'AQID',
      version: '1',
    });
    expect(parsed.profile_blob_id).toBe('AQID');
  });
});

describe('PredictionRevealSliceSchema / PredictionResolveSliceSchema', () => {
  it('reveal slice parses with the minimum required fields', () => {
    const raw = {
      identity: 'foo',
      entity_type: 0,
      sealed_at_ms: '1',
      unlock_at_ms: '2',
      revealed: false,
    };
    expect(PredictionRevealSliceSchema.parse(raw).identity).toBe('foo');
  });

  it('resolve slice tolerates missing optional resolved flag', () => {
    const raw = {
      identity: 'foo',
      entity_type: 0,
      sealed_at_ms: '1',
      revealed_at_ms: '2',
      revealed: true,
    };
    expect(PredictionResolveSliceSchema.parse(raw).revealed).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────
// External HTTP responses (Tavily, CoinGecko)

describe('TavilyResponseSchema', () => {
  it('parses a minimal valid response', () => {
    const raw = {
      query: 'ETH price',
      results: [
        {
          title: 'Ethereum',
          url: 'https://example.com',
          content: 'snippet',
          score: 0.95,
        },
      ],
    };
    expect(TavilyResponseSchema.parse(raw).results).toHaveLength(1);
  });

  it('tolerates an optional answer field', () => {
    const raw = {
      query: 'q',
      answer: 'Yes, BTC is over $100k.',
      results: [],
    };
    expect(TavilyResponseSchema.parse(raw).answer).toBe('Yes, BTC is over $100k.');
  });

  it('rejects a result missing required fields', () => {
    const raw = {
      query: 'q',
      results: [{ title: 'foo', url: 'https://x.com' }], // missing content, score
    };
    expect(() => TavilyResponseSchema.parse(raw)).toThrow();
  });
});

describe('CoinGeckoSimplePriceSchema', () => {
  it('parses a record keyed by token id', () => {
    const raw = {
      ethereum: { usd: 4500, usd_market_cap: 540_000_000_000 },
      bitcoin: { usd: 110_000 },
    };
    const parsed = CoinGeckoSimplePriceSchema.parse(raw);
    expect(parsed.ethereum?.usd).toBe(4500);
    expect(parsed.bitcoin?.usd).toBe(110_000);
  });

  it('rejects a token entry missing usd', () => {
    expect(() =>
      CoinGeckoSimplePriceSchema.parse({ ethereum: { usd_market_cap: 1 } }),
    ).toThrow();
  });
});

describe('CoinGeckoMarketChartSchema', () => {
  it('parses arrays of [timestamp_ms, value] tuples', () => {
    const raw = {
      prices: [
        [1_700_000_000_000, 100.5],
        [1_700_001_000_000, 101.2],
      ],
      market_caps: [[1_700_000_000_000, 1_000_000_000]],
      total_volumes: [[1_700_000_000_000, 5_000_000]],
    };
    const parsed = CoinGeckoMarketChartSchema.parse(raw);
    expect(parsed.prices[0]).toEqual([1_700_000_000_000, 100.5]);
  });

  it('rejects a tuple with wrong arity', () => {
    const raw = {
      prices: [[1_700_000_000_000, 100.5, 'extra']],
      market_caps: [],
      total_volumes: [],
    };
    expect(() => CoinGeckoMarketChartSchema.parse(raw)).toThrow();
  });
});

// ──────────────────────────────────────────────────────────────────────
// Walrus blob-id format check (closes the readBlob URL-concat gap)

describe('assertValidWalrusBlobId', () => {
  it('accepts a well-formed base64url blob id', () => {
    expect(() =>
      assertValidWalrusBlobId('K9pM2nL5tY7wB1eS6jH4uA8vF3xK9pM2nL5tY7wB1e'),
    ).not.toThrow();
  });

  it('rejects path-traversal shapes', () => {
    expect(() => assertValidWalrusBlobId('../../../etc/passwd')).toThrow();
    expect(() => assertValidWalrusBlobId('..')).toThrow();
  });

  it('rejects slashes, dots, and other URL-significant chars', () => {
    expect(() => assertValidWalrusBlobId('a'.repeat(41) + '/x')).toThrow();
    expect(() => assertValidWalrusBlobId('a'.repeat(41) + '.x')).toThrow();
    expect(() => assertValidWalrusBlobId('a'.repeat(41) + '?x')).toThrow();
  });

  it('rejects too-short blob ids', () => {
    expect(() => assertValidWalrusBlobId('K9pM')).toThrow();
  });

  it('rejects empty input', () => {
    expect(() => assertValidWalrusBlobId('')).toThrow();
  });
});
