// One-shot script that pings /api/cron/agent-fleet with ?backfill=N so each
// sovereign agent reaches the 3+ settled threshold needed to rank on the
// leaderboard. Run after the v3 deploy and after agent wallets have been
// funded + their private-key env vars populated.
//
//   pnpm tsx --env-file=.env.local scripts/seed-demo-fleet.ts
//   pnpm tsx --env-file=.env.local scripts/seed-demo-fleet.ts --passes 3 --base https://toldproof.xyz
//
// The cron handler signs each agent's transaction with its own keypair, so
// the script itself only needs CRON_SECRET (Bearer auth) to dial the API.

const DEFAULT_PASSES = 5;
const DEFAULT_BASE = process.env.SEED_BASE_URL ?? 'http://localhost:3000';

interface Args {
  passes: number;
  base: string;
}

function parseArgs(argv: string[]): Args {
  let passes = DEFAULT_PASSES;
  let base = DEFAULT_BASE;
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if ((a === '--passes' || a === '-p') && argv[i + 1]) {
      passes = Math.max(1, Math.min(10, Number.parseInt(argv[i + 1] ?? '', 10) || DEFAULT_PASSES));
      i += 1;
    } else if ((a === '--base' || a === '-b') && argv[i + 1]) {
      base = argv[i + 1]!;
      i += 1;
    } else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: pnpm tsx --env-file=.env.local scripts/seed-demo-fleet.ts [--passes N] [--base URL]',
      );
      process.exit(0);
    }
  }
  return { passes, base };
}

async function main() {
  const { passes, base } = parseArgs(process.argv);
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('CRON_SECRET is required (set in .env.local or pass via env).');
    process.exit(1);
  }

  const url = `${base.replace(/\/$/, '')}/api/cron/agent-fleet?backfill=${passes}`;
  console.log(`[seed] dialing ${url} with ${passes} pass${passes === 1 ? '' : 'es'}…`);

  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`[seed] ${res.status} ${res.statusText}: ${body}`);
    process.exit(1);
  }

  // The cron returns JSON with per-pass per-agent results.
  try {
    const data = JSON.parse(body) as {
      passes?: number;
      sealed?: number;
      skipped?: number;
      failed?: number;
      durationMs?: number;
    };
    console.log(
      `[seed] sealed=${data.sealed ?? 0}  skipped=${data.skipped ?? 0}  failed=${data.failed ?? 0}  durationMs=${data.durationMs ?? '?'}`,
    );
  } catch {
    console.log(body);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
