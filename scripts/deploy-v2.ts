// One-shot testnet deploy for TOLDPROOF v2.
//
// Runs `sui client publish` on the Move package, captures PACKAGE_ID +
// REGISTRY_ID + UpgradeCap, then submits the four admin txs needed to bring
// the registry to production state:
//   1. set_treasury_addr(PHANTOM)  — agent seal fees forward to your Phantom.
//                                    MUST run before set_fee<T> — per M-03
//                                    the contract rejects set_fee until the
//                                    treasury has been rotated off the deployer.
//   2. set_fee<SUI>(100_000_000)   — 0.1 SUI ≈ $0.20 per agent seal
//   3. set_fee<USDC>(200_000)      — $0.20 in micro-USDC (USDC has 6 decimals)
//   4. set_admin(PHANTOM)          — rotate admin authority to Phantom
//
// After this, the deployer keystore is dormant — Phantom controls all admin
// + receives all fees. resolver stays as the deployer/reveal-cron keypair
// (rotate via set_resolver later if running a dedicated agent wallet).
//
// Run:
//   pnpm tsx --env-file=.env.local scripts/deploy-v2.ts
//
// Required env vars (in .env.local):
//   PHANTOM_TREASURY_ADDR  — your Phantom Sui testnet address
//   NEXT_PUBLIC_SUI_RPC    — testnet RPC URL (already configured)
//   USDC_TESTNET_TYPE      — full type tag like 0x...::usdc::USDC (optional;
//                            falls back to the known testnet USDC type)

import { execSync } from 'node:child_process';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getSuiClient, loadDevKeypair } from '../lib/sui-node';
import {
  setFeeTx,
  setTreasuryAddrTx,
  setAdminTx,
  SUI_TYPE,
  USDC_TESTNET_TYPE,
} from '../lib/sui';

const SUI_FEE_MIST = 100_000_000n; // 0.1 SUI ≈ $0.20 @ $2/SUI
const USDC_FEE_MICRO = 200_000n; // 0.2 USDC = $0.20 exact (6 decimals)

interface PublishObjects {
  packageId: string;
  registryId: string;
  upgradeCapId: string;
}

function parsePublishOutput(output: string): PublishObjects {
  const parsed = JSON.parse(output);
  let packageId = '';
  let registryId = '';
  let upgradeCapId = '';

  for (const change of parsed.objectChanges ?? []) {
    if (change.type === 'published') {
      packageId = change.packageId;
    } else if (change.type === 'created') {
      const t: string = change.objectType ?? '';
      if (t.endsWith('::prediction_vault::Registry')) registryId = change.objectId;
      if (t.endsWith('::package::UpgradeCap')) upgradeCapId = change.objectId;
    }
  }

  if (!packageId || !registryId) {
    throw new Error(
      `Could not parse publish output. packageId=${packageId} registryId=${registryId}`,
    );
  }
  return { packageId, registryId, upgradeCapId };
}

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
  console.log(`  ✓ ${res.digest}`);
}

async function main() {
  console.log('────────────────────────────────────────────────────────────────');
  console.log('  TOLDPROOF v2 — testnet deploy');
  console.log('────────────────────────────────────────────────────────────────\n');

  const treasury = process.env.PHANTOM_TREASURY_ADDR;
  if (!treasury || !treasury.startsWith('0x')) {
    throw new Error(
      'PHANTOM_TREASURY_ADDR env var is required (your Phantom Sui testnet address).',
    );
  }
  const usdcType = process.env.USDC_TESTNET_TYPE ?? USDC_TESTNET_TYPE;

  const signer = loadDevKeypair();
  const deployerAddr = signer.getPublicKey().toSuiAddress();
  console.log(`Deployer:       ${deployerAddr}`);
  console.log(`Treasury/admin: ${treasury}`);
  console.log(`USDC type:      ${usdcType}\n`);

  // ─── 1. Publish ────────────────────────────────────────────────────
  console.log('Publishing Move package …');
  const cwd = `${process.cwd()}/move/prediction_vault`;
  let publishOutput: string;
  try {
    publishOutput = execSync(
      'sui client publish --gas-budget 500000000 --json --skip-dependency-verification',
      { cwd, encoding: 'utf-8', stdio: ['inherit', 'pipe', 'inherit'] },
    );
  } catch (e: unknown) {
    throw new Error(`sui client publish failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  const { packageId, registryId, upgradeCapId } = parsePublishOutput(publishOutput);
  console.log(`\n  packageId:    ${packageId}`);
  console.log(`  registryId:   ${registryId}`);
  console.log(`  upgradeCapId: ${upgradeCapId}`);

  // ─── 2. Admin txs ──────────────────────────────────────────────────
  // Order matters: set_treasury_addr MUST run before set_fee<T> (per M-03
  // the registry rejects set_fee while treasury_addr is still the deployer).
  // set_admin runs last so the deployer retains authority through the
  // earlier txs.
  console.log('\nConfiguring registry (4 admin txs from deployer)…');

  await runAdminTx(
    signer,
    setTreasuryAddrTx({ registryId, packageId, newTreasuryAddr: treasury }),
    `set_treasury_addr(${treasury})`,
  );

  await runAdminTx(
    signer,
    setFeeTx({
      registryId,
      packageId,
      coinType: SUI_TYPE,
      feeAmount: SUI_FEE_MIST,
    }),
    `set_fee<SUI>(${SUI_FEE_MIST}) — 0.1 SUI per agent seal`,
  );

  await runAdminTx(
    signer,
    setFeeTx({
      registryId,
      packageId,
      coinType: usdcType,
      feeAmount: USDC_FEE_MICRO,
    }),
    `set_fee<USDC>(${USDC_FEE_MICRO}) — 0.2 USDC per agent seal`,
  );

  await runAdminTx(
    signer,
    setAdminTx({ registryId, packageId, newAdminAddr: treasury }),
    `set_admin(${treasury}) — deployer now dormant`,
  );

  // ─── 3. Env-ready output ──────────────────────────────────────────
  console.log('\n────────────────────────────────────────────────────────────────');
  console.log('  Done. Update .env.local with:');
  console.log('────────────────────────────────────────────────────────────────\n');
  console.log(`NEXT_PUBLIC_TOLDPROOF_PACKAGE_ID=${packageId}`);
  console.log(`NEXT_PUBLIC_PREDICTION_REGISTRY_ID=${registryId}`);
  console.log(`TOLDPROOF_UPGRADE_CAP_ID=${upgradeCapId}`);
  console.log('');
  console.log('Then:');
  console.log('  1. Run `pnpm agents:gen` to generate the demo agent fleet wallets');
  console.log('  2. Fund each agent address with ~5 testnet SUI');
  console.log('  3. Optional: set TOLDPROOF_X402_RECIPIENT (Base address) for MCP payments');
  console.log('  4. Set TAVILY_API_KEY for web search in the Resolution Agent');
  console.log('  5. Deploy to Vercel — crons start firing on schedule');
}

main().catch((e) => {
  console.error('\n✗ Deploy failed:', e);
  process.exit(1);
});
