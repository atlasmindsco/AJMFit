/**
 * The from-scratch skeletons, and the day-rename machinery.
 *
 * The rename half is the part worth testing hard. Workout rows store a day's
 * NAME, the rotation matches on that name, and a rename that does not carry
 * history across silently wipes a client's green ticks and sends them back to
 * day one. Getting the ORDER of renames wrong is worse: it merges two days'
 * history into one, and there is nothing to merge it back from.
 */
import { readFileSync } from 'node:fs'
import { renamesFor, planRenameOps } from '../lib/day-renames.ts'
import { templatesFor, emptyWeek, genericWeek, DAY_COUNT_CHOICES } from '../lib/builder-templates.ts'
import { canSave } from '../lib/builder-rules.ts'
import { rotationState } from '../lib/rotation.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 56), detail)
}

const prog = (days: Array<{ name: string; key?: string }>) =>
  days.map((d) => ({ name: d.name, ...(d.key ? { key: d.key } : {}) }))

console.log('THE FROM-SCRATCH SKELETONS\n')
{
  for (const n of DAY_COUNT_CHOICES) {
    const ts = templatesFor(n)
    g(`${n} days offers at least one split`, ts.length >= 1, ts.map((t) => t.label).join(', '))
    g(`${n} days: every skeleton has ${n} days`, ts.every((t) => t.dayNames.length === n))
  }

  // Duplicate day names are the one thing that breaks the rotation outright,
  // so no skeleton may ship with them.
  const all = DAY_COUNT_CHOICES.flatMap((n) => templatesFor(n))
  const dupes = all.filter((t) => new Set(t.dayNames).size !== t.dayNames.length)
  g('no skeleton has a duplicate day name', dupes.length === 0, dupes[0]?.key ?? '')

  // And every skeleton must survive canSave once a single exercise is added,
  // or the client fills a week and cannot save it.
  const bad = all.filter((t) => {
    const week = emptyWeek(t).map((d, i) => ({ ...d, exercises: i === 0 ? [{} as never] : [] }))
    return !canSave({ name: 'X', days: week }).ok
  })
  g('every skeleton can be saved', bad.length === 0, bad[0]?.key ?? '')

  g('a skeleton week starts empty', emptyWeek(templatesFor(4)[0]).every((d) => d.exercises.length === 0))
  g('the generic fallback still names days', genericWeek(3).map((d) => d.name).join(',') === 'Day 1,Day 2,Day 3')
}

console.log('\nWHICH DAYS WERE RENAMED')
console.log('Matched on identity, not position.\n')
{
  const before = prog([{ name: 'Upper A', key: 'a' }, { name: 'Lower A', key: 'b' }])

  g('no change, no renames', renamesFor(before, before).length === 0)

  const renamed = prog([{ name: 'Chest Day', key: 'a' }, { name: 'Lower A', key: 'b' }])
  const r1 = renamesFor(before, renamed)
  g('one rename is found', r1.length === 1 && r1[0].from === 'Upper A' && r1[0].to === 'Chest Day')

  // Renaming AND reordering is one rename. Comparing by index would call it two.
  const moved = prog([{ name: 'Lower A', key: 'b' }, { name: 'Chest Day', key: 'a' }])
  const r2 = renamesFor(before, moved)
  g('rename plus reorder is still one rename', r2.length === 1 && r2[0].to === 'Chest Day', JSON.stringify(r2))

  // Reordering alone must move nothing: history is keyed on the name.
  const justMoved = prog([{ name: 'Lower A', key: 'b' }, { name: 'Upper A', key: 'a' }])
  g('reordering alone is not a rename', renamesFor(before, justMoved).length === 0)

  const added = prog([{ name: 'Upper A', key: 'a' }, { name: 'Lower A', key: 'b' }, { name: 'Arms' }])
  g('a new day is not a rename', renamesFor(before, added).length === 0)

  const deleted = prog([{ name: 'Upper A', key: 'a' }])
  g('a deleted day is not a rename', renamesFor(before, deleted).length === 0)

  // A copy carries no keys at all, which is what stops it rewriting the
  // history of the program it was copied from.
  const copy = prog([{ name: 'Totally Different' }, { name: 'Also Different' }])
  g('a keyless copy renames nothing', renamesFor(prog([{ name: 'Upper A' }, { name: 'Lower A' }]), copy).length === 0)

  const spaced = prog([{ name: '  Upper A  ', key: 'a' }, { name: 'Lower A', key: 'b' }])
  g('whitespace alone is not a rename', renamesFor(before, spaced).length === 0)

  const cased = prog([{ name: 'upper a', key: 'a' }, { name: 'Lower A', key: 'b' }])
  g('a case change IS a rename', renamesFor(before, cased).length === 1, 'the rotation matches exactly')

  const blanked = prog([{ name: '   ', key: 'a' }, { name: 'Lower A', key: 'b' }])
  g('blanking a name moves nothing', renamesFor(before, blanked).length === 0)
}

console.log('\nTHE ORDER RENAMES ARE APPLIED IN')
console.log('Apply these in the wrong order and two days merge into one.\n')
{
  const apply = (names: string[], ops: Array<{ from: string; to: string }>) => {
    let out = [...names]
    for (const op of ops) out = out.map((n) => (n === op.from ? op.to : n))
    return out
  }

  const simple = planRenameOps([{ from: 'A', to: 'X' }, { from: 'B', to: 'Y' }])
  g('independent renames need no sentinel', simple.length === 2)
  g('and they land correctly', apply(['A', 'B'], simple).join(',') === 'X,Y')

  // The chain: B must vacate "A" only after A has moved out of it.
  const chain = planRenameOps([{ from: 'A', to: 'C' }, { from: 'B', to: 'A' }])
  g('a chain is ordered, not sentinelled', chain.length === 2 && chain[0].from === 'A', JSON.stringify(chain))
  g('a chain lands correctly', apply(['A', 'B'], chain).join(',') === 'C,A')

  // The chain given in the WORST input order must still come out right.
  const chainRev = planRenameOps([{ from: 'B', to: 'A' }, { from: 'A', to: 'C' }])
  g('input order does not matter', apply(['A', 'B'], chainRev).join(',') === 'C,A', JSON.stringify(chainRev))

  // The swap: no ordering works, so one side goes via a sentinel.
  const swap = planRenameOps([{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }])
  g('a swap uses a sentinel', swap.length === 3, JSON.stringify(swap.map((o) => `${o.from}>${o.to}`)))
  g('a swap actually swaps', apply(['A', 'B'], swap).join(',') === 'B,A')
  g('no sentinel is left behind', !apply(['A', 'B'], swap).some((n) => n.includes('__ajmfit')))

  // A three-way cycle, which a client reordering day names could produce.
  const cycle = planRenameOps([{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }, { from: 'C', to: 'A' }])
  g('a 3-cycle resolves', apply(['A', 'B', 'C'], cycle).join(',') === 'B,C,A', JSON.stringify(cycle.map((o) => `${o.from}>${o.to}`)))

  // The naive version — just applying them as given — gets this wrong, which
  // is the whole reason planRenameOps exists.
  const naive = apply(['A', 'B'], [{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }])
  g('and the naive order really is broken', naive.join(',') === 'A,A', `naive gives ${naive.join(',')}`)

  g('a no-op rename is dropped', planRenameOps([{ from: 'A', to: 'A' }]).length === 0)
  g('an empty list is empty', planRenameOps([]).length === 0)
  g('cycles plus independents coexist', apply(['A', 'B', 'Q'],
    planRenameOps([{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }, { from: 'Q', to: 'Z' }])).join(',') === 'B,A,Z')
}

console.log('\nWHY THE MIGRATION MATTERS AT ALL')
console.log('What the rotation does to a rename that did not migrate.\n')
{
  const days = ['Upper A', 'Lower A', 'Upper B', 'Lower B']
  const trainable = [true, true, true, true]
  const hist = [
    { dayName: 'Upper A', at: '2026-10-01T10:00:00Z' },
    { dayName: 'Lower A', at: '2026-10-02T10:00:00Z' },
  ]

  const before = rotationState(days, trainable, hist)
  g('two days done, next is Upper B', before.completed.size === 2 && days[before.todayIndex] === 'Upper B')

  // Rename "Upper A" to "Chest Day" and migrate nothing.
  const orphaned = rotationState(['Chest Day', 'Lower A', 'Upper B', 'Lower B'], trainable, hist)
  g('without migrating, a session is orphaned', orphaned.completed.size === 1, `${orphaned.completed.size} of 2 still counted`)

  // Migrate, and the rotation is undisturbed.
  const migrated = rotationState(
    ['Chest Day', 'Lower A', 'Upper B', 'Lower B'],
    trainable,
    hist.map((h) => (h.dayName === 'Upper A' ? { ...h, dayName: 'Chest Day' } : h))
  )
  g('migrating keeps both and the same next day', migrated.completed.size === 2 && ['Chest Day', 'Lower A', 'Upper B', 'Lower B'][migrated.todayIndex] === 'Upper B')
}

console.log('\nTHE SKELETON NAMES MATCH THE AUTHORED LIBRARY')
console.log('A built week and a copied week must speak the same language,')
console.log('because day names are what workout history keys on.\n')
{
  // Checked against program-library/blueprint-library.json — the authored
  // source the seeder reads — rather than against the database, so this
  // catches drift at the point someone edits the library.
  const lib = JSON.parse(
    readFileSync(new URL('../program-library/blueprint-library.json', import.meta.url), 'utf8')
  ) as { splits: Record<string, { days: Array<{ name: string; activeRest?: boolean }> }> }

  const short = (n: string) => n.replace(/^day\s*\d+\s*[—–-]\s*/i, '').trim() || n
  const mine = DAY_COUNT_CHOICES.flatMap((n) => templatesFor(n))

  for (const t of mine) {
    const split = lib.splits[t.key]
    if (!split) {
      g(`${t.key} exists in the library`, false, 'no such split')
      continue
    }
    // Active-rest days are dropped: an empty day a client cannot fill with
    // anything the builder expresses is just a confusing row.
    const authored = split.days.filter((d) => !d.activeRest).map((d) => short(d.name))
    g(`${t.key} names match`, authored.join('|') === t.dayNames.join('|'), authored.join(' · '))
  }

  // And the converse: a split offered in the picker but missing day names here
  // silently disappears from the builder. That is allowed, but only for the
  // hybrid tracks, whose prescriptions the builder cannot express.
  const offered = Object.keys(lib.splits).filter((k) => !k.startsWith('hybrid_'))
  const missing = offered.filter((k) => !mine.some((t) => t.key === k))
  g('every non-hybrid split has a skeleton', missing.length === 0, missing.join(', '))
}

console.log(fail === 0 ? '\nAll pass-2 checks passed.' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
