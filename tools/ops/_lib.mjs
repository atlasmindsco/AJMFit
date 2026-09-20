/**
 * Shared helpers for the tools/ops/* operations scripts.
 *
 * These scripts run against production with the service role, so the contract
 * every one of them follows is: build the full plan in memory, print it, and
 * only write once the operator passes --confirm. Dry run is the default.
 *
 * See AGENTS.md §2 for the safety model these helpers implement.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

/** Print an error and stop. Never returns. */
export function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

/**
 * Load .env.local into process.env for local runs. Existing env vars always
 * win, so a hosted environment's real secret store is never clobbered by a
 * stale local file. Missing file is fine — that's the hosted case.
 */
function loadLocalEnv() {
  let raw
  try {
    raw = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
  } catch {
    return
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!match) continue
    const key = match[1]
    if (process.env[key] !== undefined) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1)
    } else {
      value = value.replace(/\s+#.*$/, '').trim()
    }
    process.env[key] = value
  }
}

/**
 * Parse argv into `{ _: [positionals], <flag>: true|string }`.
 * Supports `--flag`, `--key=value`, and bare positionals.
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] }
  for (const token of argv) {
    if (!token.startsWith('--')) {
      args._.push(token)
      continue
    }
    const body = token.slice(2)
    const eq = body.indexOf('=')
    if (eq === -1) args[body] = true
    else args[body.slice(0, eq)] = body.slice(eq + 1)
  }
  return args
}

/**
 * Service-role Supabase client. Bypasses RLS — every caller is responsible for
 * gating its own writes behind requireConfirm().
 */
export function supa() {
  loadLocalEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) fail('NEXT_PUBLIC_SUPABASE_URL is not set.')
  if (!key) fail('SUPABASE_SERVICE_ROLE_KEY is not set.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

/**
 * The confirm gate. Without --confirm this prints what would happen and exits
 * cleanly, so callers can treat everything after it as confirmed.
 */
export function requireConfirm(args, description) {
  if (args.confirm) return
  console.log(`\nDRY RUN — nothing was written.`)
  console.log(`Would: ${description}`)
  console.log(`\nRe-run with --confirm to apply.\n`)
  process.exit(0)
}

/**
 * Append to the operations action log.
 *
 * Best-effort by design: it runs after a write has already succeeded, so a
 * logging failure must not fail the script or imply the operation was rolled
 * back. It warns loudly instead.
 */
export async function logAction({ action, target = null, summary, detail = null, actor = 'ops-toolkit' }) {
  console.log(`[log] ${action}${target ? ` · ${target}` : ''} — ${summary}`)
  try {
    const { error } = await supa()
      .from('ops_action_log')
      .insert({ action, target, summary, detail, actor })
    if (error) throw new Error(error.message)
  } catch (e) {
    console.warn(
      `⚠ Action log not written: ${e.message}\n` +
        `  The operation itself succeeded. If the table is missing, apply ` +
        `supabase/migrations/20260919_ops_action_log.sql.`
    )
  }
}
