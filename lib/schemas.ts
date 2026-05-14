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

// On-chain `SealedPrediction` struct (move/prediction_vault/sources). Optional
// fields are the v2 resolution attestation — present once the Resolution Agent
// has called resolve().
export const SealedPredictionFieldsSchema = z.object({
  publisher: z.string(),
  identity: z.string(),
  entity_type: z.number(),
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
});
export type SealedPredictionFields = z.infer<typeof SealedPredictionFieldsSchema>;

// Subset of `Registry` we read — the by_identity Table object id is all we need
// to enumerate handles. Extra fields are allowed (Move struct may grow).
export const RegistryFieldsSchema = z.object({
  by_identity: z.object({
    fields: z.object({
      id: z.object({ id: z.string() }),
      size: z.string(),
    }),
  }),
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
