/** Verifies live DB state for the Blueprint picker (tables, columns, seeds). */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim()
}
const c = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

const tables = await c.query(`select table_name from information_schema.tables
  where table_schema='public' and table_name in ('program_days','program_exercises','programs') order by 1`)
console.log('tables:', tables.rows.map((r) => r.table_name).join(', ') || 'NONE')

const cols = await c.query(`select column_name from information_schema.columns
  where table_schema='public' and table_name='programs' order by ordinal_position`)
console.log('programs columns:', cols.rows.map((r) => r.column_name).join(', '))

try {
  const n = await c.query(`select count(*)::int n from public.programs where source='blueprint'`)
  console.log('blueprint programs:', n.rows[0].n)
  const days = await c.query(`select count(*)::int n from public.program_days`)
  const exs = await c.query(`select count(*)::int n from public.program_exercises`)
  console.log('program_days rows:', days.rows[0].n, '| program_exercises rows:', exs.rows[0].n)
} catch (e) {
  console.log('content query failed:', e.message)
}
await c.end()
