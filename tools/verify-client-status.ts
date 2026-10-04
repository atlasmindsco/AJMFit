/**
 * client-status imports weekOf() from check-ins, which pulls in the browser
 * Supabase client at module load. These are throwaway values purely so the
 * module graph resolves; nothing here touches a network.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'

const { clientStatus, STATUS_ORDER, STATUS_META } = await import('../lib/client-status.ts')
type ClientStatus = Parameters<typeof STATUS_ORDER.indexOf>[0]
type CheckIn = Parameters<typeof clientStatus>[0]['checkIns'][number]

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 52), detail)
}

const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString()
const day = (d: number) => ago(d).slice(0, 10)

/**
 * Monday of the week N weeks back, matching weekOf().
 *
 * Formatted from LOCAL parts, not toISOString(). The first version used
 * toISOString and passed all day, then failed after about 8pm Eastern, when
 * the UTC date rolls over and the helper starts naming a different Monday from
 * the product. A test that only fails in the evening is worse than one that
 * never passes.
 */
const weekBack = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - n * 7)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const ci = (over: Partial<CheckIn> = {}): CheckIn =>
  ({
    id: 'x',
    user_id: 'u',
    week_of: weekBack(0),
    submitted_at: ago(1),
    coach_response: 'Nice work',
    coach_responded_at: ago(0),
    energy: 4,
    nutrition_adherence: 4,
    weight_lb: 180,
    ...over,
  }) as CheckIn

const base = { coached: true, lastWorkoutAt: day(1), checkIns: [ci()] }

console.log('NEVER STARTED IS NOT THE SAME AS GONE QUIET\n')
{
  // Four of eleven live clients are here, and they used to share a status with
  // someone who trained for two months and then stopped.
  const fresh = clientStatus({ ...base, lastWorkoutAt: null, signedUpAt: ago(1) })
  g('day 1, not started -> no alarm', fresh.status === 'on_track', fresh.status)

  const d2 = clientStatus({ ...base, lastWorkoutAt: null, signedUpAt: ago(2) })
  g('day 2, still inside the grace', d2.status === 'on_track', d2.status)

  const d3 = clientStatus({ ...base, lastWorkoutAt: null, signedUpAt: ago(3) })
  g('day 3 -> never_started', d3.status === 'never_started', d3.status)
  g('and the reason names the age', d3.reason.includes('3 days'), d3.reason)

  const d30 = clientStatus({ ...base, lastWorkoutAt: null, signedUpAt: ago(30) })
  g('a month in, never trained', d30.status === 'never_started', d30.reason)

  // Trained once, then stopped: a different problem, a different status.
  const quit = clientStatus({ ...base, lastWorkoutAt: day(40), signedUpAt: ago(90) })
  g('trained then stopped -> at_risk', quit.status === 'at_risk', quit.status)

  // Unknown signup date must not crash or wrongly excuse.
  const noDate = clientStatus({ ...base, lastWorkoutAt: null })
  g('missing signup date still flags', noDate.status === 'never_started', noDate.status)
}

console.log('\nTRAINING HARD, GOING NOWHERE\n')
{
  const declining = clientStatus({
    ...base,
    stalledLifts: [{ exerciseName: 'Barbell Bench Press', verdict: 'cut_back' }],
  })
  g('a declining lift is surfaced', declining.status === 'needs_attention', declining.status)
  g('and names the lift', declining.reason.includes('Barbell Bench Press'), declining.reason)

  const many = clientStatus({
    ...base,
    stalledLifts: [
      { exerciseName: 'Bench', verdict: 'cut_back' },
      { exerciseName: 'Squat', verdict: 'cut_back' },
    ],
  })
  g('several are counted, not listed', many.reason === '2 lifts going backwards', many.reason)

  const stuck = clientStatus({ ...base, stalledLifts: [{ exerciseName: 'Squat', verdict: 'change_exercise' }] })
  g('a plateau is surfaced', stuck.status === 'needs_attention' && stuck.reason.includes('stalled'), stuck.reason)

  // Declining outranks merely stuck.
  const both = clientStatus({
    ...base,
    stalledLifts: [
      { exerciseName: 'Squat', verdict: 'change_exercise' },
      { exerciseName: 'Bench', verdict: 'cut_back' },
    ],
  })
  g('going backwards is reported first', both.reason.includes('Bench'), both.reason)

  g('no stalls changes nothing', clientStatus({ ...base, stalledLifts: [] }).status === 'on_track')
}

console.log('\nLOUDER SIGNALS STILL WIN\n')
{
  const stalls = [{ exerciseName: 'Bench', verdict: 'cut_back' }]

  // An unanswered check-in is the coach's own backlog and beats everything.
  const owed = clientStatus({ ...base, checkIns: [ci({ coach_response: null })], stalledLifts: stalls })
  g('unanswered check-in outranks a stall', owed.status === 'review_needed', owed.status)

  // A quiet client is a bigger problem than a stalled lift.
  const quiet = clientStatus({ ...base, lastWorkoutAt: day(12), stalledLifts: stalls })
  g('gone quiet outranks a stall', quiet.status === 'at_risk', quiet.status)

  // The client's own words outrank an inference about their training.
  const lowEnergy = clientStatus({ ...base, checkIns: [ci({ energy: 1 })], stalledLifts: stalls })
  g('low energy outranks a stall', lowEnergy.reason.includes('Energy'), lowEnergy.reason)

  // A block ending has a deadline; a stall does not.
  const block = clientStatus({ ...base, blockEndsInDays: 2, stalledLifts: stalls })
  g('block ending outranks a stall', block.reason.includes('block'), block.reason)
}

console.log('\nTHE SET STAYS SMALL AND ORDERED\n')
{
  g('six statuses, no more', STATUS_ORDER.length === 6, String(STATUS_ORDER.length))
  g('every status has a label', STATUS_ORDER.every((s) => Boolean(STATUS_META[s as ClientStatus]?.label)))
  g('never_started ranks just under review_needed', STATUS_ORDER.indexOf('never_started') === 1)
  g('on_track is last', STATUS_ORDER.at(-1) === 'on_track')
  const all = new Set(STATUS_ORDER)
  g('no duplicates in the order', all.size === STATUS_ORDER.length)
}

console.log('\nBLUEPRINT CLIENTS ARE NOT CHASED FOR CHECK-INS\n')
{
  const bp = clientStatus({ coached: false, lastWorkoutAt: day(1), checkIns: [] })
  g('no check-in expected', bp.status === 'on_track', bp.status)
  const coached = clientStatus({ coached: true, lastWorkoutAt: day(1), checkIns: [] })
  g('a coached client is asked', coached.status !== 'on_track', coached.status)
}


console.log('\nTHE TIER PROMISE IS CHECKED\n')
{
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString()
  const unanswered = (h: number) => [ci({ coach_response: null, submitted_at: hoursAgo(h) })]

  // Accelerator sells 48 hours; Full Experience 24. Both were shown to the
  // client and neither was ever checked.
  const inTime = clientStatus({ ...base, checkIns: unanswered(20), responseHours: 48 })
  g('inside the window reads normally', !inTime.reason.includes('promised'), inTime.reason)

  const late = clientStatus({ ...base, checkIns: unanswered(72), responseHours: 48 })
  g('past 48h says so', late.reason.includes('past the 48h promised'), late.reason)

  const lateFE = clientStatus({ ...base, checkIns: unanswered(36), responseHours: 24 })
  g('Full Experience is held to 24h', lateFE.reason.includes('past the 24h promised'), lateFE.reason)
  g('and the same wait is fine on 48h',
    !clientStatus({ ...base, checkIns: unanswered(36), responseHours: 48 }).reason.includes('promised'))

  // Blueprint promises best effort, so there is nothing to be late against.
  const bp = clientStatus({ ...base, checkIns: unanswered(200), responseHours: null })
  g('Blueprint is never "late"', !bp.reason.includes('promised'), bp.reason)
  g('but still shows as review needed', bp.status === 'review_needed')
}
console.log('\n' + (fail === 0 ? 'ALL CLIENT STATUS CHECKS PASSED' : `*** ${fail} FAILURES ***`))
if (fail > 0) process.exitCode = 1
