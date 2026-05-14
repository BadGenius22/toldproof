// Tiny one-shot migration runner for Neon.
// Uses the @neondatabase/serverless Pool (node-postgres compatible) which
// accepts multi-statement SQL in a single .query() call.
//
// Run:
//   pnpm tsx --env-file=.env.local scripts/migrate.ts migrations/001_x_auth.sql

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from '@neondatabase/serverless';

async function main() {
  const path = process.argv[2];
  if (!path) {
    throw new Error('Usage: pnpm tsx --env-file=.env.local scripts/migrate.ts <path-to-sql>');
  }
  const dbUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set.');

  const sql = readFileSync(resolve(path), 'utf8');
  console.log(`→ Running ${path} against Neon…`);

  const pool = new Pool({ connectionString: dbUrl });
  try {
    await pool.query(sql);
    console.log('✓ Migration applied');

    // Verify
    const { rows } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`,
    );
    console.log('\nTables in public schema:');
    for (const r of rows) console.log(`  • ${r.table_name}`);
  } finally {
    await pool.end();
  }
}

main().catch((e: unknown) => {
  console.error('✗ Migration failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
