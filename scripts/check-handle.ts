// One-shot diagnostic: list every on-chain prediction filed under a handle.
// Helps debug "why does the leaderboard count look off" — the count comes
// from the Registry's by_identity table, not anywhere editable off-chain.
//
//   pnpm tsx --env-file=.env.local scripts/check-handle.ts dewaxindo

import { getSuiClientForReads, getPredictionsForIdentity } from '../lib/registry';

async function main() {
  const handle = process.argv[2];
  if (!handle) {
    console.error('Usage: pnpm tsx --env-file=.env.local scripts/check-handle.ts <handle>');
    process.exit(1);
  }
  const client = getSuiClientForReads();
  const preds = await getPredictionsForIdentity(client, handle);
  console.log(`Total under "${handle}": ${preds.length}`);
  for (const p of preds) {
    const date = new Date(p.sealedAtMs).toISOString().slice(0, 19);
    console.log(
      `  ${p.id.slice(0, 10)}…  sealed=${date}  revealed=${p.revealed}  resolved=${p.resolved}  hit=${p.hit}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
