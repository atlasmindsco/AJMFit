/**
 * Runs a .sql migration file against the database (DATABASE_URL in .env.local).
 *   node scripts/migrate.mjs supabase/migrations/0003_xyz.sql
 *   node scripts/migrate.mjs --test          # connection check
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const url = env.DATABASE_URL
if (!url) { console.error('DATABASE_URL missing'); process.exit(1) }

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
} catch (e) {
  console.error('CONNECT FAILED:', e.message)
  process.exit(2)
}

const arg = process.argv[2]
try {
  if (!arg || arg === '--test') {
    const r = await client.query('select current_database() db, current_user usr, version()')
    console.log('connected:', r.rows[0].db, '/', r.rows[0].usr)
    const t = await client.query("select count(*)::int n from information_schema.tables where table_schema='public'")
    console.log('public tables:', t.rows[0].n)
  } else {
    const sql = readFileSync(new URL('../' + arg, import.meta.url), 'utf8')
    await client.query(sql)
    console.log(`applied: ${arg}`)
  }
} catch (e) {
  console.error('SQL ERROR:', e.message)
  await client.end()
  process.exit(3)
}
await client.end()
process.exit(0)
