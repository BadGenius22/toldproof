// Strongly-typed env loader.
//
// IMPORTANT: NEXT_PUBLIC_* values are inlined into the client bundle by
// Next.js, but ONLY when accessed via LITERAL property names like
// `process.env.NEXT_PUBLIC_FOO`. A dynamic lookup like
// `process.env[varName]` cannot be statically replaced and will be
// undefined at browser runtime. That's why every getter below reads
// the literal `process.env.NEXT_PUBLIC_X` directly.
//
// Getter pattern (vs eager object literal) keeps reads lazy — values
// are only required when a field is actually accessed, so this module
// evaluates without throwing during Turbopack client-component
// pre-evaluation in dev SSR.
//
// Run scripts via:
//   tsx --env-file=.env.local scripts/foo.ts   (Node 24+)
// or the `pnpm seal` / `pnpm reveal` package scripts.

function must(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  get suiNetwork() {
    return must('NEXT_PUBLIC_SUI_NETWORK', process.env.NEXT_PUBLIC_SUI_NETWORK);
  },
  get suiRpc() {
    return must('NEXT_PUBLIC_SUI_RPC', process.env.NEXT_PUBLIC_SUI_RPC);
  },
  get packageId() {
    return must('NEXT_PUBLIC_TOLDPROOF_PACKAGE_ID', process.env.NEXT_PUBLIC_TOLDPROOF_PACKAGE_ID);
  },
  get registryId() {
    return must(
      'NEXT_PUBLIC_PREDICTION_REGISTRY_ID',
      process.env.NEXT_PUBLIC_PREDICTION_REGISTRY_ID,
    );
  },
  get walrusPublisher() {
    return must('NEXT_PUBLIC_WALRUS_PUBLISHER_URL', process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL);
  },
  get walrusAggregator() {
    return must(
      'NEXT_PUBLIC_WALRUS_AGGREGATOR_URL',
      process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL,
    );
  },
  get sealKeyServer1() {
    return must('NEXT_PUBLIC_SEAL_KEY_SERVER_1', process.env.NEXT_PUBLIC_SEAL_KEY_SERVER_1);
  },
  get sealKeyServer2() {
    return must('NEXT_PUBLIC_SEAL_KEY_SERVER_2', process.env.NEXT_PUBLIC_SEAL_KEY_SERVER_2);
  },
  get sealKeyServer3() {
    // Optional 3rd operator for 2-of-3 committee. Falls back to empty string
    // when only running 2-of-2 in dev — getSealClient drops empty entries.
    return process.env.NEXT_PUBLIC_SEAL_KEY_SERVER_3 ?? '';
  },
  get sealThreshold() {
    return Number(must('NEXT_PUBLIC_SEAL_THRESHOLD', process.env.NEXT_PUBLIC_SEAL_THRESHOLD));
  },
} as const;
