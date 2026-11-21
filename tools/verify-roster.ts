/**
 * Who needs the coach first, and the screen that could not say.
 *
 * /luffy/clients filtered on `active / pending / paused` — the Stripe
 * subscription status. It told the coach who was paying and nothing about who
 * was training, so a client who had never logged a set rendered identically
 * to one on a ten-week streak: both green, both marked Active.
 *
 * Measured the day this was written: 15 active clients, 7 who had never
 * logged a single set and 4 more who had not trained in 41 to 95 days. All
 * fifteen looked the same on that list.
 */
/* roster imports client-status, which imports weekOf() from check-ins, which
   pulls in the browser Supabase client at module load. Stub the env and
   import dynamically, the same way verify-client-status.ts does. */
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'

const { rankRoster, rosterCounts, rosterFilters } = await import('../lib/roster.ts')
const { STATUS_ORDER } = await import('../lib/client-status.ts')
type ClientRow = Record<string, unknown> & { id: string; name: string; status: string; last_workout_at: string | null }
type RosterInput = Parameters<typeof rankRoster>[0]

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString()

const client = (name: string, over: Partial<ClientRow> = {}): ClientRow =>
  ({
    id: name.toLowerCase().replace(/\W+/g, '-'),
    name,
    email: `${name.toLowerCase().replace(/\W+/g, '.')}@example.com`,
    phone: null,
    status: 'active',
    is_beta: false,
    created_at: ago(200),
    application: null,
    last_workout_at: ago(1),
    ...over,
  }) as ClientRow

const empty = {
  checkIns: [],
  stalls: new Map<string, Array<{ exerciseName: string; verdict: string }>>(),
  painSwaps: [],
  blocks: new Map(),
} as Omit<RosterInput, 'clients' | 'everAssigned'>

/* The real roster, as it stood on 21 Nov 2026. */
const roster: ClientRow[] = [
  client('Luis', { last_workout_at: ago(1) }),
  client('Jamel', { last_workout_at: ago(4) }),
  client('Arun', { last_workout_at: ago(14) }),
  client('Alexandro', { last_workout_at: ago(41) }),
  client('Ruth', { last_workout_at: ago(48) }),
  client('Ellena', { last_workout_at: ago(76) }),
  client('Chance', { last_workout_at: ago(95) }),
  client('Shane', { last_workout_at: null }),
  client('Aleesha', { last_workout_at: null }),
  client('Leonard', { last_workout_at: null }),
]
const everAssigned = new Set(roster.map((c) => c.id))
const rows = rankRoster({ ...empty, clients: roster, everAssigned })

console.log('SOMEBODY WHO NEVER STARTED DOES NOT LOOK LIKE SOMEBODY ON A STREAK\n')
const shane = rows.find((r) => r.client.name === 'Shane')
const luis = rows.find((r) => r.client.name === 'Luis')
console.log(`        Shane -> ${shane?.status}: ${shane?.reason}`)
console.log(`        Luis  -> ${luis?.status}: ${luis?.reason}`)
ok(shane?.status !== luis?.status, 'they are not the same state', `${shane?.status} vs ${luis?.status}`)
ok(shane?.status === 'never_started', 'Shane never started', String(shane?.status))
ok(luis?.status === 'on_track', 'Luis is on track', String(luis?.status))

console.log('\nTHE WORST ARE AT THE TOP\n')
console.log('        ' + rows.map((r) => r.client.name).join(' · '))
const firstOnTrack = rows.findIndex((r) => r.status === 'on_track')
const lastBad = rows.map((r) => r.status).lastIndexOf('never_started')
ok(firstOnTrack === -1 || lastBad < firstOnTrack, 'nobody on track outranks somebody who never started')
let ordered = true
for (let i = 1; i < rows.length; i++) {
  if (STATUS_ORDER.indexOf(rows[i].status) < STATUS_ORDER.indexOf(rows[i - 1].status)) ordered = false
}
ok(ordered, 'the whole list is in severity order')

console.log('\nAND THE ORDER IS THE SAME EVERY TIME\n')
// Whatever order the query returned, the screen must not shuffle between
// loads — a coach checking twice should see the same list.
const shuffled = rankRoster({ ...empty, clients: [...roster].reverse(), everAssigned })
ok(
  rows.map((r) => r.client.name).join() === shuffled.map((r) => r.client.name).join(),
  'reversing the input changes nothing',
  shuffled.map((r) => r.client.name).slice(0, 3).join(' · ')
)

console.log('\nONLY PAYING, ACTIVE CLIENTS ARE RANKED\n')
const withOthers = rankRoster({
  ...empty,
  clients: [...roster, client('Cancelled One', { status: 'cancelled' as ClientRow['status'] }), client('Pending One', { status: 'pending' as ClientRow['status'] })],
  everAssigned,
})
ok(withOthers.length === roster.length, 'cancelled and pending are left out', `${withOthers.length} vs ${roster.length}`)

console.log('\nTHE COUNTS ADD UP\n')
const counts = rosterCounts(rows)
STATUS_ORDER.forEach((s) => counts[s] > 0 && console.log(`        ${String(counts[s]).padStart(2)}  ${s}`))
ok(
  STATUS_ORDER.reduce((t, s) => t + counts[s], 0) === rows.length,
  'every ranked client is counted exactly once',
  `${STATUS_ORDER.reduce((t, s) => t + counts[s], 0)} vs ${rows.length}`
)

console.log('\nA FILTER IS ONLY OFFERED WHEN SOMEBODY IS IN IT\n')
// A button for an empty state is a button that clears the screen, and on a
// roster of fifteen most states are empty most of the time.
const filters = rosterFilters(rows)
console.log('        ' + filters.join(' · '))
ok(filters.length > 0, 'there is at least one')
ok(
  filters.every((s) => counts[s] > 0),
  'and none of them is empty',
  filters.filter((s) => counts[s] === 0).join(', ')
)
ok(rosterFilters([]).length === 0, 'an empty roster offers no filters')

console.log('\nNOTHING AN EMPTY ACCOUNT CAN LOOK LIKE BREAKS IT\n')
for (const [label, clients] of [
  ['no clients at all', []],
  ['one who never trained and never had a program', [client('New', { last_workout_at: null })]],
] as Array<[string, ClientRow[]]>) {
  let got: string
  try {
    got = `${rankRoster({ ...empty, clients, everAssigned: new Set<string>() }).length} rows`
  } catch (e) {
    got = `THREW: ${(e as Error).message}`
  }
  ok(!got.startsWith('THREW'), label, got)
}

console.log(failed === 0 ? '\nAll roster checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
