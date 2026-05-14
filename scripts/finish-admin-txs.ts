// Recovery script — runs the remaining admin txs against an already-published
// Registry. Use this when scripts/deploy-v3.ts has published the package +
// rotated treasury_addr but failed on a later admin tx (e.g. the fullnode
// stale-state race that prompted us to add waitForTransaction).
//
// Usage:
//   pnpm tsx --env-file=.env.local scripts/finish-admin-txs.ts \
//     <PACKAGE_ID> <REGISTRY_ID>
//
// Assumes:
//   - set_treasury_addr has ALREADY run (Registry.treasury_initialized=true)
//   - deployer keystore still holds the admin role (set_admin hasn't run yet)

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { getSuiClient, loadDevKeypair } from '../lib/sui-node';
import {
  setFeeTx,
  setAdminTx,
  SUI_TYPE,
  USDC_TESTNET_TYPE,
} from '../lib/sui';

const SUI_FEE_MIST = 50_000_000n;
const USDC_FEE_MICRO = 100_000n;

async function runAdminTx(
  signer: Ed25519Keypair,
  tx: Transaction,
  label: string,
): Promise<void> {
  const client = getSuiClient();
  console.log(`\n→ ${label}`);
  const res = await client.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: { showEffects: true },
  });
  const status = res.effects?.status?.status;
  if (status !== 'success') {
    throw new Error(`${label} failed: ${JSON.stringify(res.effects?.status)}`);
  }
  await client.waitForTransaction({ digest: res.digest });
  console.log(`  ✓ ${res.digest}`);
}

async function main() {
  const [, , packageId, registryId] = process.argv;
  if (!packageId?.startsWith('0x') || !registryId?.startsWith('0x')) {
    throw new Error(
      'Usage: pnpm tsx --env-file=.env.local scripts/finish-admin-txs.ts <PACKAGE_ID> <REGISTRY_ID>',
    );
  }

  const treasury = process.env.PHANTOM_TREASURY_ADDR;
  if (!treasury || !treasury.startsWith('0x')) {
    throw new Error('PHANTOM_TREASURY_ADDR env var is required.');
  }
  const usdcType = process.env.USDC_TESTNET_TYPE ?? USDC_TESTNET_TYPE;

  const signer = loadDevKeypair();
  const deployerAddr = signer.getPublicKey().toSuiAddress();
  console.log('────────────────────────────────────────────────────────────────');
  console.log('  TOLDPROOF — finish admin txs on existing Registry');
  console.log('────────────────────────────────────────────────────────────────\n');
  console.log(`Deployer:     ${deployerAddr}`);
  console.log(`Treasury:     ${treasury}`);
  console.log(`Package:      ${packageId}`);
  console.log(`Registry:     ${registryId}`);
  console.log(`USDC type:    ${usdcType}\n`);

  await runAdminTx(
    signer,
    setFeeTx({
      registryId,
      packageId,
      coinType: SUI_TYPE,
      feeAmount: SUI_FEE_MIST,
    }),
    `set_fee<SUI>(${SUI_FEE_MIST}) — 0.05 SUI per agent seal`,
  );

  await runAdminTx(
    signer,
    setFeeTx({
      registryId,
      packageId,
      coinType: usdcType,
      feeAmount: USDC_FEE_MICRO,
    }),
    `set_fee<USDC>(${USDC_FEE_MICRO}) — 0.1 USDC per agent seal`,
  );

  await runAdminTx(
    signer,
    setAdminTx({ registryId, packageId, newAdminAddr: treasury }),
    `set_admin(${treasury}) — deployer now dormant`,
  );

  console.log('\n────────────────────────────────────────────────────────────────');
  console.log('  Done. Update .env.local with:');
  console.log('────────────────────────────────────────────────────────────────\n');
  console.log(`NEXT_PUBLIC_TOLDPROOF_PACKAGE_ID=${packageId}`);
  console.log(`NEXT_PUBLIC_PREDICTION_REGISTRY_ID=${registryId}`);
}

main().catch((err: unknown) => {
  console.error(
    `\n✗ Failed: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
