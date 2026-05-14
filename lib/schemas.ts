// Runtime schemas for everything we read from Sui RPC and external HTTP.
// Replaces the systemic `as unknown as Foo` pattern with `.parse()` calls so
// shape drift between Move ↔ TS is caught at the boundary, not silently absorbed.
//
// Why one shared module: 8+ sites parsed the same SealedPrediction shape with
// independent type assertions. One schema means one place to update when the
// Move struct gains a field, and one place to look when a parse failure shows
// up in production logs.

import { z } from 'zod';

// Sui RPC returns `vector<u8>` either as a base64 string or a number[] depending
// on the field annotation. Both shapes flow through lib/sui.ts `toBytes()`.
export const BytesFieldSchema = z.union([z.array(z.number()), z.string()]);
export type BytesField = z.infer<typeof BytesFieldSchema>;

// On-chain `SealedPrediction` struct (move/prediction_vault/sources).
//
// v1 of the contract used `x_handle: String` and had no resolution attestation.
// v2 renamed to `identity: String`, added `entity_type: u8`, and added the
// resolved/hit/resolved_at_ms/reasoning_blob_id/resolver fields. Until v2 is
// redeployed on testnet, the front-end must handle both shapes.
//
// The schema accepts either name (via transform below) and treats every
// v2-only field as optional. parsePrediction() in lib/registry.ts is the
// single consumer that bridges this back into the typed PredictionView.
export const SealedPredictionFieldsSchema = z
  .object({
    publisher: z.string(),
    // v2 field name (preferred)
    identity: z.string().optional(),
    // v1 field name (still on live testnet deploy)
    x_handle: z.string().optional(),
    entity_type: z.number().optional(),
    sealed_at_ms: z.string(),
    unlock_at_ms: z.string(),
    content_hash: BytesFieldSchema,
    blob_id: BytesFieldSchema,
    sealed_key: BytesFieldSchema,
    revealed: z.boolean(),
    revealed_at_ms: z.string(),
    revealed_plaintext: BytesFieldSchema,
    resolved: z.boolean().optional(),
    hit: z.boolean().optional(),
    resolved_at_ms: z.string().optional(),
    reasoning_blob_id: BytesFieldSchema.optional(),
    resolver: z.string().optional(),
  })
  .refine((d) => d.identity || d.x_handle, {
    message: 'SealedPrediction has neither identity nor x_handle field',
  })
  .transform((d) => ({
    ...d,
    // Normalize so every consumer can read .identity regardless of contract version.
    identity: d.identity ?? d.x_handle ?? '',
    // v1 had no entity_type — every v1 prediction was a human.
    entity_type: d.entity_type ?? 0,
  }));
export type SealedPredictionFields = z.infer<typeof SealedPredictionFieldsSchema>;

// Subset of `Registry` we read — the lookup Table's object id is all we need
// to enumerate identities.
//
// v2 of the Move contract renamed `by_handle` to `by_identity` (so humans and
// agents share the same table). The live testnet deploy is still v1, so we
// accept either name. Whichever is present wins; if both are present the
// newer `by_identity` is preferred. Extra fields on the Registry are allowed.
const TableHandle = z.object({
  fields: z.object({
    id: z.object({ id: z.string() }),
    size: z.string(),
  }),
});

export const RegistryFieldsSchema = z
  .object({
    by_identity: TableHandle.optional(),
    by_handle: TableHandle.optional(),
  })
  .refine((d) => d.by_identity || d.by_handle, {
    message:
      'Registry object has neither by_identity nor by_handle — wrong package version?',
  });
export type RegistryFields = z.infer<typeof RegistryFieldsSchema>;

// Dynamic field value for `by_identity[identity]` → `vector<ID>` of prediction
// object IDs.
export const IdentityPredictionListSchema = z.object({
  value: z.array(z.string()),
});

// Just the identity slice of SealedPrediction — for cheap lookups that don't
// need the full payload (e.g., reputation cron mapping prediction → identity).
export const PredictionIdentitySliceSchema = z.object({
  identity: z.string(),
});

// Lightweight slice for scanner.ts unlocked-but-unrevealed sweep.
export const PredictionRevealSliceSchema = z.object({
  identity: z.string(),
  entity_type: z.number(),
  sealed_at_ms: z.string(),
  unlock_at_ms: z.string(),
  revealed: z.boolean(),
});
export type PredictionRevealSlice = z.infer<typeof PredictionRevealSliceSchema>;

// Lightweight slice for scanner.ts revealed-but-unresolved sweep.
export const PredictionResolveSliceSchema = z.object({
  identity: z.string(),
  entity_type: z.number(),
  sealed_at_ms: z.string(),
  revealed_at_ms: z.string(),
  revealed: z.boolean(),
  resolved: z.boolean().optional(),
});
export type PredictionResolveSlice = z.infer<typeof PredictionResolveSliceSchema>;

// Move event: emit_event(PredictionResolved { prediction_id }) in resolve().
export const PredictionResolvedEventSchema = z.object({
  prediction_id: z.string(),
});

// Move event: emit_event(ReputationProfileUpdated { identity, profile_blob_id, version })
export const ReputationProfileUpdatedEventSchema = z.object({
  identity: z.string(),
  profile_blob_id: BytesFieldSchema,
  version: z.string(),
});

// getDynamicFields entry shape — `name.value` is the unwrapped key (here an
// identity string), `objectId` is the dynamic field object's id.
export const DynamicFieldEntrySchema = z.object({
  name: z.object({
    type: z.string(),
    value: z.unknown(),
  }),
  objectId: z.string(),
});
export type DynamicFieldEntry = z.infer<typeof DynamicFieldEntrySchema>;

// Walrus blob IDs are base64url-encoded BLAKE2b hashes — fixed-length, no `/`
// or `.`. Reject anything else before it reaches a URL concatenation.
const WALRUS_BLOB_ID = /^[A-Za-z0-9_-]{40,64}$/;
export function assertValidWalrusBlobId(blobId: string): void {
  if (!WALRUS_BLOB_ID.test(blobId)) {
    throw new Error(`Invalid Walrus blob ID format: ${JSON.stringify(blobId.slice(0, 32))}`);
  }
}

// ---------- External HTTP API responses ----------
//
// Used by the Resolution Agent's evidence-gathering tools (lib/agent-tools.ts).
// Schemas are intentionally lenient — these APIs add fields over time and we
// don't want a benign field rename to break the agent loop. Required fields
// are the minimum we actually read.

// Tavily web search response. https://docs.tavily.com/docs/rest-api/api-reference
export const TavilyResponseSchema = z.object({
  query: z.string(),
  answer: z.string().nullable().optional(),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      content: z.string(),
      score: z.number(),
      published_date: z.string().optional(),
    }),
  ),
});

// CoinGecko /simple/price response — an object keyed by token id, each value
// has a usd field and optional market-cap / 24h-change / last-updated fields.
export const CoinGeckoSimplePriceSchema = z.record(
  z.string(),
  z.object({
    usd: z.number(),
    usd_market_cap: z.number().optional(),
    usd_24h_change: z.number().optional(),
    last_updated_at: z.number().optional(),
  }),
);

// CoinGecko /coins/{id}/market_chart response — arrays of [timestamp_ms, value]
// tuples for prices, market caps, and total volumes.
const TimestampedSample = z.tuple([z.number(), z.number()]);
export const CoinGeckoMarketChartSchema = z.object({
  prices: z.array(TimestampedSample),
  market_caps: z.array(TimestampedSample),
  total_volumes: z.array(TimestampedSample),
});
