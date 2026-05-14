// Generates fresh Sui Ed25519 keypairs for the entire demo agent fleet.
// Prints the addresses + Bech32-encoded private keys to stdout so you can
// drop them into .env.local (or Vercel env config).
//
// Usage:
//   pnpm tsx --env-file=.env.local scripts/generate-agent-wallets.ts
//
// After running, FUND each address with ~5-10 testnet SUI from the Sui faucet
// so the agents can pay gas + 0.1 SUI fees per seal.

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { AGENT_FLEET } from '../lib/agent-personas';

console.log('────────────────────────────────────────────────────────────────');
console.log('  TOLDPROOF Demo Agent Fleet — wallet generation');
console.log('────────────────────────────────────────────────────────────────\n');

const dotEnvLines: string[] = [];
for (const persona of AGENT_FLEET) {
  const kp = Ed25519Keypair.generate();
  const addr = kp.getPublicKey().toSuiAddress();
  // getSecretKey() returns Bech32 'suiprivkey1...' format which fromSecretKey() accepts.
  const secret = kp.getSecretKey();

  console.log(`Agent:    ${persona.alias}`);
  console.log(`Model:    ${persona.model}`);
  console.log(`Address:  ${addr}`);
  console.log(`SecretKey (Bech32, treat as secret): ${secret}`);
  console.log('');

  dotEnvLines.push(`# ${persona.alias} (${persona.model})`);
  dotEnvLines.push(`# Sui address: ${addr}`);
  dotEnvLines.push(`# Fund this address with ~5 testnet SUI before the cron runs.`);
  dotEnvLines.push(`${persona.privateKeyEnvVar}=${secret}`);
  dotEnvLines.push('');
}

console.log('────────────────────────────────────────────────────────────────');
console.log('  Add these lines to .env.local (or Vercel env):');
console.log('────────────────────────────────────────────────────────────────\n');
console.log(dotEnvLines.join('\n'));

console.log('\nNext steps:');
console.log('  1. Save the env vars above to .env.local (or Vercel env config).');
console.log('  2. Fund each agent address with 5-10 testnet SUI from the faucet.');
console.log('  3. After testnet redeploy completes, the /api/cron/agent-fleet');
console.log('     cron will fire every 6 hours and produce one prediction per agent.');
