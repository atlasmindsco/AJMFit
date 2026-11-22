/**
 * Whether the daily jobs are running, and saying so when they are not.
 *
 * They were not, for five weeks, and nothing anywhere said so. `cron_runs`
 * held exactly one row in the product's history — the digest, 14 October
 * 2026 — and `notifications_sent` was empty, so not one reminder ever reached
 * a client. Eleven of fifteen active clients were dormant or had never
 * trained while the system built to catch that sat silent.
 *
 * The run on 14 October wrote its own summary: "1 client waiting on a reply ·
 * 8 gone quiet". It was correct. Nobody saw it.
 */
import { cronHealth, cronWarning, STALE_AFTER_HOURS, type CronRun } from '@/lib/cron-health'

let failed = 0
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${extra ? '  — ' + extra : ''}`)
}

const NOW = new Date('2026-11-22T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600000).toISOString()
const run = (job: string, h: number, okFlag: boolean | null = true): CronRun => ({
  job,
  ran_at: hoursAgo(h),
  ok: okFlag,
})
const EXPECT = ['digest', 'reminders']

console.log('A JOB THAT HAS NEVER RUN IS THE LOUDEST CASE\n')
/* This is the state the app was actually in: reminders had no row at all. */
const never = cronHealth([run('digest', 2)], EXPECT, NOW)
const rem = never.find((h) => h.job === 'reminders')
ok(rem?.hoursSince === null, 'no row means no run', String(rem?.hoursSince))
ok(rem?.stale === true, 'and that is stale, not unknown')
ok(/never run/.test(String(cronWarning(never))), 'the words say so', String(cronWarning(never)))

console.log('\nTHE REAL OCTOBER STATE\n')
// Digest on 14 Oct, reminders never, read on 22 Nov: 39 days.
const october = cronHealth([run('digest', 39 * 24)], EXPECT, NOW)
console.log(`        -> ${cronWarning(october)}`)
ok(october.every((h) => h.stale), 'both jobs flagged')
ok(/39 days ago/.test(String(cronWarning(october))), 'with how long it has been', String(cronWarning(october)))

console.log('\nNOTHING IS SAID WHEN EVERYTHING IS RUNNING\n')
/* The check that keeps this from becoming a banner the coach learns to
   ignore. A daily job that ran this morning is fine, and so is one that ran
   yesterday — they do not fire at the same hour. */
const healthy = cronHealth([run('digest', 2), run('reminders', 14)], EXPECT, NOW)
ok(cronWarning(healthy) === null, 'silence is the healthy state', String(cronWarning(healthy)))
ok(healthy.every((h) => !h.stale), 'neither is stale')
ok(
  cronWarning(cronHealth([run('digest', 25), run('reminders', 25)], EXPECT, NOW)) === null,
  'a day and an hour late is still fine',
  String(cronWarning(cronHealth([run('digest', 25), run('reminders', 25)], EXPECT, NOW)))
)

console.log('\nTHE LINE BETWEEN LATE AND BROKEN\n')
console.log(`        stale after ${STALE_AFTER_HOURS} hours`)
ok(
  cronHealth([run('digest', STALE_AFTER_HOURS - 1)], ['digest'], NOW)[0].stale === false,
  'an hour before the threshold is late'
)
ok(
  cronHealth([run('digest', STALE_AFTER_HOURS)], ['digest'], NOW)[0].stale === true,
  'at the threshold it is broken'
)
ok(STALE_AFTER_HOURS > 24, 'the threshold allows a full missed day plus slack', String(STALE_AFTER_HOURS))

console.log('\nA FAILED RUN DOES NOT COUNT AS A RUN\n')
/* A job that ran and threw is not a job that worked, and the heartbeat row
   it writes carries ok=false. Counting it would hide exactly the failure
   this exists to show. */
const onlyFailures = cronHealth([run('digest', 1, false)], ['digest'], NOW)
ok(onlyFailures[0].hoursSince === null, 'a failed run is no run', String(onlyFailures[0].hoursSince))
ok(onlyFailures[0].stale === true, 'and still counts as stale')
ok(
  cronHealth([run('digest', 1, null), run('digest', 50, true)], ['digest'], NOW)[0].stale === false,
  'but a null ok is treated as a run, because older rows predate the flag'
)

console.log('\nTHE NEWEST RUN IS THE ONE THAT MATTERS\n')
const mixed = cronHealth([run('digest', 100), run('digest', 3), run('digest', 60)], ['digest'], NOW)
ok(mixed[0].hoursSince === 3, 'out-of-order rows still resolve to the latest', String(mixed[0].hoursSince))

console.log('\nAND NOTHING MALFORMED BREAKS THE DASHBOARD\n')
for (const [label, runs] of [
  ['no rows at all', []],
  ['a row with a nonsense date', [{ job: 'digest', ran_at: 'soon', ok: true }]],
  ['a job nobody expects', [run('mystery', 1)]],
] as Array<[string, CronRun[]]>) {
  let got: string
  try {
    got = String(cronWarning(cronHealth(runs, EXPECT, NOW)))
  } catch (e) {
    got = `THREW: ${(e as Error).message}`
  }
  ok(!got.startsWith('THREW'), label, got.slice(0, 60))
}

console.log(failed === 0 ? '\nAll cron-health checks passed.' : `\n${failed} CHECK${failed === 1 ? '' : 'S'} FAILED`)
process.exit(failed === 0 ? 0 : 1)
