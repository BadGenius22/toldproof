// Node-only Sui helpers: keypair loading from ~/.sui/sui_config/sui.keystore +
// JSON-RPC client constructor. Importing this from a browser bundle will fail
// because it depends on node:fs / node:os / node:path.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';
import { env } from './env';
import type { SuiClient } from './sui';

export function getSuiClient(): SuiClient {
  return new SuiJsonRpcClient({
    url: env.suiRpc,
    network: env.suiNetwork as 'testnet' | 'mainnet' | 'devnet' | 'localnet',
  });
}

// Loads the same keypair that `sui client` uses from ~/.sui/sui_config/sui.keystore.
// Format: JSON array of base64 strings, each = [flag(1) || secret(32)] for ed25519 (flag=0x00).
export function loadDevKeypair(): Ed25519Keypair {
  const path = join(homedir(), '.sui/sui_config/sui.keystore');
  const keys = JSON.parse(readFileSync(path, 'utf-8')) as string[];
  if (!keys[0]) throw new Error(`keystore at ${path} is empty`);
  const raw = fromBase64(keys[0]);
  const secret = raw.byteLength === 33 ? raw.slice(1) : raw;
  if (secret.byteLength !== 32) {
    throw new Error(`unexpected ed25519 secret length: ${secret.byteLength}`);
  }
  return Ed25519Keypair.fromSecretKey(secret);
}
