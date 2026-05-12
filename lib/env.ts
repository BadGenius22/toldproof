// Strongly-typed env loader. Run scripts via:
//   tsx --env-file=.env.local scripts/foo.ts   (Node 24+)
// or the `pnpm seal` / `pnpm reveal` package scripts.

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  suiNetwork: required('NEXT_PUBLIC_SUI_NETWORK'),
  suiRpc: required('NEXT_PUBLIC_SUI_RPC'),
  packageId: required('NEXT_PUBLIC_TOLDPROOF_PACKAGE_ID'),
  registryId: required('NEXT_PUBLIC_PREDICTION_REGISTRY_ID'),
  walrusPublisher: required('NEXT_PUBLIC_WALRUS_PUBLISHER_URL'),
  walrusAggregator: required('NEXT_PUBLIC_WALRUS_AGGREGATOR_URL'),
  sealKeyServer1: required('NEXT_PUBLIC_SEAL_KEY_SERVER_1'),
  sealKeyServer2: required('NEXT_PUBLIC_SEAL_KEY_SERVER_2'),
  sealThreshold: Number(required('NEXT_PUBLIC_SEAL_THRESHOLD')),
} as const;
