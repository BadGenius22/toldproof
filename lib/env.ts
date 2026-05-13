// Strongly-typed env loader.
//
// Reads are LAZY (getter-backed) so this module evaluates without throwing.
// Earlier eager validation broke Next.js 16 + Turbopack client-component
// pre-evaluation, where NEXT_PUBLIC_* values aren't guaranteed to be in
// process.env at module load time on the server. We still fail-fast when a
// value is actually accessed.
//
// Run scripts via:
//   tsx --env-file=.env.local scripts/foo.ts   (Node 24+)
// or the `pnpm seal` / `pnpm reveal` package scripts.

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  get suiNetwork() {
    return required('NEXT_PUBLIC_SUI_NETWORK');
  },
  get suiRpc() {
    return required('NEXT_PUBLIC_SUI_RPC');
  },
  get packageId() {
    return required('NEXT_PUBLIC_TOLDPROOF_PACKAGE_ID');
  },
  get registryId() {
    return required('NEXT_PUBLIC_PREDICTION_REGISTRY_ID');
  },
  get walrusPublisher() {
    return required('NEXT_PUBLIC_WALRUS_PUBLISHER_URL');
  },
  get walrusAggregator() {
    return required('NEXT_PUBLIC_WALRUS_AGGREGATOR_URL');
  },
  get sealKeyServer1() {
    return required('NEXT_PUBLIC_SEAL_KEY_SERVER_1');
  },
  get sealKeyServer2() {
    return required('NEXT_PUBLIC_SEAL_KEY_SERVER_2');
  },
  get sealThreshold() {
    return Number(required('NEXT_PUBLIC_SEAL_THRESHOLD'));
  },
} as const;
