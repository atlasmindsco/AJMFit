/**
 * Create (or remove) a throwaway Blueprint account to click through the app.
 *
 * WHAT THIS DOES AND DOES NOT PROVE
 *
 * It builds the account the way a Blueprint buyer's account ends up looking —
 * users row, accepted blueprint application, a login with a password already
 * set — so you can sign in and walk the whole member experience: the program
 * picker, nutrition, meal photos, logging.
 *
 * It does NOT exercise the new post-checkout password page. That page needs a
 * genuinely paid Stripe Checkout Session less than 24 hours old, and the only
 * honest way to produce one is to actually buy Blueprint (a 100%-off promotion
 * code makes that free). Everything downstream of the password being set is
 * what this script lets you test.
 *
 * No subscriptions row on purpose: tier then resolves from the application,
 * which is the same fallback the real beta accounts use, and it keeps a fake
 * subscription out of billing reports.
 *
 *   node tools/ops/test-blueprint-account.mjs --email=dummy@ajmfit.test
 *   node tools/ops/test-blueprint-account.mjs --email=dummy@ajmfit.test --remove
 *   add --confirm to write
 */
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { supa, parseArgs, requireConfirm, logAction, fail } from './_lib.mjs'

const args = parseArgs()
const sb = supa()

const email = String(args.email || '').toLowerCase().trim()
if (!email || !email.includes('@')) fail('Need --email=<address>.')

// A guard rail, not a formality: this script sets passwords and deletes
// accounts, and pointing it at a real client by typo would be ugly.
if (!/(@ajmfit\.test$|\+test[^@]*@|^test[.-])/i.test(email)) {
  fail(
    `"${email}" does not look like a test address.\n` +
    `  Use something ending @ajmfit.test, or a +test tag, so a real client can never be hit.`
  )
}

/* ─────────────── remove ─────────────── */

if (args.remove) {
  const { data: user } = await sb.from('users').select('id, auth_id').eq('email', email).maybeSingle()
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authUser = (list?.users ?? []).find((u) => u.email?.toLowerCase() === email)

  if (!user && !authUser) fail(`Nothing found for ${email}.`)

  console.log(`\n  remove  ${email}`)
  console.log(`  users row      ${user ? user.id : '(none)'}`)
  console.log(`  login          ${authUser ? authUser.id : '(none)'}\n`)

  requireConfirm(args, `delete the test account ${email}`)

  if (user) {
    // Children first: anything pointing at the user row would block the delete.
    for (const table of ['program_assignments', 'applications', 'onboarding_forms']) {
      const { error } = await sb.from(table).delete().eq('user_id', user.id)
      if (error) console.warn(`  (${table}: ${error.message})`)
    }
    const { error } = await sb.from('users').delete().eq('id', user.id)
    if (error) fail(error.message)
  }
  if (authUser) await sb.auth.admin.deleteUser(authUser.id)

  await logAction({ action: 'remove_test_account', summary: `Removed test Blueprint account ${email}` })
  console.log('✔ Removed.\n')
  process.exit(0)
}

/* ─────────────── create ─────────────── */

const { data: clash } = await sb.from('users').select('id').eq('email', email).maybeSingle()
if (clash) fail(`${email} already exists. Remove it first with --remove.`)

const name = String(args.name || 'Blueprint Test')
// Generated, not chosen: nothing memorable ever becomes a habit this way.
const password = `ajm-${randomBytes(9).toString('base64url')}`

console.log(`\n  create  ${email}`)
console.log(`  name    ${name}`)
console.log(`  tier    blueprint (from an accepted application, no subscription)`)
console.log(`  login   password set, email pre-confirmed\n`)

requireConfirm(args, `create the test Blueprint account ${email}`)

const { data: user, error: uErr } = await sb
  .from('users')
  .insert({ name, email, status: 'pending' })
  .select('id')
  .single()
if (uErr) fail(uErr.message)

const { error: aErr } = await sb.from('applications').insert({
  user_id: user.id,
  goals: 'Test account (tools/ops/test-blueprint-account.mjs)',
  equipment: [],
  availability: 'Self-guided',
  tier: 'blueprint',
  billing_cycle: 'monthly',
  status: 'accepted',
  reviewed_at: new Date().toISOString(),
})
if (aErr) fail(aErr.message)

const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})
if (authErr) fail(authErr.message)

const { error: linkErr } = await sb.from('users').update({ auth_id: authUser.user.id }).eq('id', user.id)
if (linkErr) fail(linkErr.message)

// The password goes to a gitignored file rather than the terminal, so it does
// not end up in scrollback, a screenshot or a pasted log.
const out = new URL('../../.env.test-account.local', import.meta.url)
writeFileSync(
  out,
  `# Throwaway Blueprint test account. Gitignored. Delete with:\n` +
    `#   node tools/ops/test-blueprint-account.mjs --email=${email} --remove --confirm\n` +
    `TEST_ACCOUNT_EMAIL=${email}\n` +
    `TEST_ACCOUNT_PASSWORD=${password}\n`,
  'utf8'
)

await logAction({ action: 'create_test_account', summary: `Created test Blueprint account ${email}` })

console.log('✔ Created.')
console.log(`  Sign in at /members`)
console.log(`  Credentials written to .env.test-account.local (gitignored)\n`)
