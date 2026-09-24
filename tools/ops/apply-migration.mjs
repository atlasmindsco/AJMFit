/**
 * Apply one SQL migration to production.
 *
 * Follows the same contract as the other ops scripts: inspect and print first,
 * write only on --confirm. Dry run is the default.
 *
 *   node tools/ops/apply-migration.mjs supabase/migrations/<file>.sql
 *   node tools/ops/apply-migration.mjs supabase/migrations/<file>.sql --confirm
 *
 * The migration itself is expected to be idempotent (add column if not
 * exists, create index if not exists) and wrapped in its own transaction.
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

function loadLocalEnv() {
  let raw
  try {
    raw = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
  } catch {
    return
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    if (process.env[m[1]] !== undefined) continue
    let v = m[2].trim()
    if (v.length > 1 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
      v = v.slice(1, -1)
    }
    process.env[m[1]] = v
  }
}

const file = process.argv[2]
const confirm = process.argv.includes('--confirm')
if (!file) {
  console.error('\n✖ Usage: node tools/ops/apply-migration.mjs <path/to/migration.sql> [--confirm]\n')
  process.exit(1)
}

loadLocalEnv()
const url = process.env.DATABASE_URL
if (!url) {
  console.error('\n✖ DATABASE_URL is not set.\n')
  process.exit(1)
}

const sql = readFileSync(file, 'utf8')

console.log(`\nMigration: ${file}`)
console.log('─'.repeat(72))
console.log(sql.split('\n').filter((l) => l.trim() && !l.trim().startsWith('--')).join('\n'))
console.log('─'.repeat(72))

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

// Show the columns this migration touches, before and after.
const COLS = `
  select column_name, data_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'users'
    and column_name in ('health_screen','nutrition_block_code','health_screened_at')
  order by column_name`

const before = await client.query(COLS)
console.log(`\nBefore: ${before.rowCount} of 3 target columns exist`)
for (const r of before.rows) console.log(`  ${r.column_name} (${r.data_type})`)

if (!confirm) {
  console.log('\nDRY RUN. Nothing was written. Re-run with --confirm to apply.\n')
  await client.end()
  process.exit(0)
}

try {
  await client.query(sql)
  const after = await client.query(COLS)
  console.log(`\nAfter: ${after.rowCount} of 3 target columns exist`)
  for (const r of after.rows) console.log(`  ${r.column_name} (${r.data_type})`)
  console.log('\n✓ Applied.\n')
} catch (e) {
  console.error(`\n✖ Failed: ${e.message}\n`)
  process.exitCode = 1
} finally {
  await client.end()
}
