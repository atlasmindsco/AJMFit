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

/**
 * Inspect whatever the migration claims to create, so the operator sees the
 * before and after rather than trusting the exit code. Tables and columns are
 * read out of the SQL itself.
 */
const tables = [...sql.matchAll(/create table if not exists public\.(\w+)/gi)].map((m) => m[1])
const altered = [...sql.matchAll(/alter table public\.(\w+)/gi)].map((m) => m[1])
const addedCols = [...sql.matchAll(/add column if not exists (\w+)/gi)].map((m) => m[1])

async function snapshot() {
  const out = []
  for (const t of new Set([...tables, ...altered])) {
    const { rows } = await client.query(
      `select to_regclass($1) is not null as present`,
      [`public.${t}`]
    )
    out.push(`  table public.${t}: ${rows[0].present ? 'present' : 'absent'}`)
  }
  if (addedCols.length) {
    const { rows } = await client.query(
      `select table_name, column_name from information_schema.columns
       where table_schema='public' and column_name = any($1) order by table_name, column_name`,
      [addedCols]
    )
    out.push(`  columns present: ${rows.length} of ${addedCols.length}`)
    for (const r of rows) out.push(`    ${r.table_name}.${r.column_name}`)
  }
  return out.join('\n') || '  (nothing declarative to inspect)'
}

console.log('\nBefore:')
console.log(await snapshot())

if (!confirm) {
  console.log('\nDRY RUN. Nothing was written. Re-run with --confirm to apply.\n')
  await client.end()
  process.exit(0)
}

try {
  await client.query(sql)
  console.log('\nAfter:')
  console.log(await snapshot())
  console.log('\n✓ Applied.\n')
} catch (e) {
  console.error(`\n✖ Failed: ${e.message}\n`)
  process.exitCode = 1
} finally {
  await client.end()
}
