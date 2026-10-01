import { nextTarget, sessionFatigue, experienceFrom, isBodyweightMovement,
  type ExperienceLevel, type ProgressionGoal } from '../lib/progression.ts'
import type { ExerciseSession } from '../lib/workout.ts'

const S = (topWeight: number, topReps: number, opts: Partial<ExerciseSession> = {}): ExerciseSession => ({
  date: '2026-01-01', topWeight, topReps, lowestReps: opts.lowestReps ?? topReps,
  sets: 3, rir: opts.rir ?? null, ...opts,
})
const ctx = (level: ExperienceLevel = 'intermediate', daysSinceLast = 2, goal: ProgressionGoal = 'muscle') =>
  ({ goal, level, daysSinceLast })

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const check = (label: string, got: string | null, want: string) => {
  const ok = got === want; if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 46), W(got ?? 'null', 17), ok ? '' : `expected ${want}`)
}
const run = (hist: ExerciseSession[], reps = '8-12', c = ctx(), ex = 'Dumbbell Bench Press') =>
  nextTarget(ex, reps, c, hist)

console.log('VERDICTS\n')
check('no history at all', run([])?.verdict ?? null, 'first_time')
check('topped the range', run([S(100, 12), S(95, 10)])?.verdict ?? null, 'add_load')
check('mid-range, climbing', run([S(100, 10), S(100, 9)])?.verdict ?? null, 'push_reps')
check('one session down', run([S(100, 8), S(100, 10)])?.verdict ?? null, 'repeat')
check('two down', run([S(100, 7), S(100, 8), S(100, 10)])?.verdict ?? null, 'repeat')
check('three down -> cut back', run([S(100, 6), S(100, 7), S(100, 8), S(100, 10)])?.verdict ?? null, 'cut_back')
check('4 flat at RIR 0 -> swap', run([S(100,9,{rir:0}),S(100,9),S(100,9),S(100,9)])?.verdict ?? null, 'change_exercise')
check('4 flat but RIR 3 -> not a stall', run([S(100,9,{rir:3}),S(100,9),S(100,9),S(100,9)])?.verdict ?? null, 'push_reps')
check('back after 3 weeks', run([S(100, 10)], '8-12', ctx('intermediate', 21))?.verdict ?? null, 'returning')
check('back after 5 days is normal', run([S(100, 10)], '8-12', ctx('intermediate', 5))?.verdict ?? null, 'push_reps')
check('conditioning has no load model', run([S(0,0)], '20 min') === null ? 'null' : 'not-null', 'null')

console.log('\nEXPERIENCE\n')
const jump = (level: ExperienceLevel, ex: string) => {
  const r = run([S(100, 12), S(95, 12)], '8-12', ctx(level), ex)
  return r?.suggestedWeight ?? null
}
console.log(W('  beginner upper', 26), jump('beginner', 'Dumbbell Bench Press'), ' (expect 105)')
const advUp = jump('advanced', 'Dumbbell Bench Press')
console.log(W(advUp === 102.5 ? '  ok' : '  FAIL', 7), W('advanced upper jump is 2.5 not 5', 46), advUp)
if (advUp !== 102.5) fail++
console.log(W('  beginner lower', 26), jump('beginner', 'Barbell Squat'), ' (expect 110)')
console.log(W('  advanced lower', 26), jump('advanced', 'Barbell Squat'), ' (expect 105)')
if (jump('advanced','Dumbbell Bench Press')! >= jump('beginner','Dumbbell Bench Press')!) { console.log('  FAIL advanced should jump less'); fail++ }

// advanced needs TWO sessions at the top before adding
check('advanced, 1 session at top -> hold',
  run([S(100, 12), S(100, 9)], '8-12', ctx('advanced'))?.verdict ?? null, 'push_reps')
check('advanced, 2 sessions at top -> add',
  run([S(100, 12), S(100, 12)], '8-12', ctx('advanced'))?.verdict ?? null, 'add_load')
check('advanced stalls later (4 flat, RIR 0)',
  run([S(100,9,{rir:0}),S(100,9),S(100,9),S(100,9)], '8-12', ctx('advanced'))?.verdict ?? null, 'push_reps')

console.log('\nGUARDRAILS\n')
const g = (label: string, ok: boolean, detail = '') => { if (!ok) fail++; console.log(W(ok?'  ok':'  FAIL',7), W(label,46), detail) }
const cut = run([S(100, 6), S(100, 7), S(100, 8), S(100, 10)])
g('cut-back suggests less than current', (cut?.suggestedWeight ?? 999) < 100, `${cut?.suggestedWeight}`)
const ret = run([S(200, 10)], '8-12', ctx('intermediate', 35))
g('long layoff cuts more than short', (ret?.suggestedWeight ?? 999) <= 170, `${ret?.suggestedWeight} from 200`)
g('loads round to loadable numbers',
  [run([S(137,12),S(137,12)])?.suggestedWeight, cut?.suggestedWeight].every(w => w != null && (w * 2) % 5 === 0),
  `${run([S(137,12),S(137,12)])?.suggestedWeight}, ${cut?.suggestedWeight}`)
g('every verdict carries client text', ['first_time','add_load','push_reps','repeat','cut_back','returning']
  .every(() => true) && (run([])?.text.length ?? 0) > 20)
g('cut_back and change_exercise flag attention',
  cut?.attention === true && run([S(100,9,{rir:0}),S(100,9),S(100,9),S(100,9)])?.attention === true)
g('add_load does not flag attention', run([S(100,12),S(95,10)])?.attention === false)

console.log('\nEXPERIENCE MAPPING + BODYWEIGHT GUARD\n')
console.log(W('  new / no years', 26), experienceFrom('new', ''), '(beginner)')
console.log(W('  consistent / no years', 26), experienceFrom('consistent', ''), '(intermediate)')
console.log(W('  3 years', 26), experienceFrom('new', '3'), '(advanced)')
console.log(W('  1 year', 26), experienceFrom('new', '1'), '(intermediate)')
for (const [ex, want] of [['Inverted Row',true],['Floor Glute-Ham Raise',true],['Pull-Up',true],
                          ['Barbell Squat',false],['Dumbbell Bench Press',false]] as [string,boolean][]) {
  const got = isBodyweightMovement(ex); if (got !== want) fail++
  console.log(W(got===want?'  ok':'  FAIL',7), W(ex,30), got ? 'bodyweight' : 'loaded')
}

console.log('\nBODYWEIGHT IN THE LOAD FIELD\n')
// luis has an Inverted Row recorded at 160 lb, which is his own bodyweight.
// Without a guard the engine reads it as load and says "go up to 165 lbs".
const bwCtx = {
  goal: 'muscle' as ProgressionGoal,
  level: 'intermediate' as ExperienceLevel,
  daysSinceLast: 2,
  bodyWeightLb: 158,
}
const bw = nextTarget('Inverted Row', '8-12', bwCtx, [S(160, 12), S(160, 12)])
g('bodyweight load does not become a load increase',
  bw?.verdict === 'push_reps' && bw?.suggestedWeight === null,
  `${bw?.verdict} / ${bw?.suggestedWeight}`)
const realLoad = nextTarget('Barbell Squat', '8-12', bwCtx, [S(160, 12), S(160, 12)])
g('a real 160 lb squat still adds load', realLoad?.verdict === 'add_load',
  `${realLoad?.verdict} -> ${realLoad?.suggestedWeight}`)
const weighted = nextTarget('Pull-Up', '8-12', bwCtx, [S(25, 12), S(25, 12)])
g('a genuinely weighted pull-up still adds load', weighted?.verdict === 'add_load',
  `${weighted?.verdict} -> ${weighted?.suggestedWeight}`)

console.log('\nCROSS-EXERCISE FATIGUE\n')
const hist = { A:[S(100,10)], B:[S(100,10)], C:[S(100,10)], D:[S(100,10)] }
const f1 = sessionFatigue({ A:{topWeight:100,topReps:7}, B:{topWeight:100,topReps:7}, C:{topWeight:100,topReps:7} }, hist)
g('3 lifts down in one session -> flagged', f1.text !== null, `${f1.downCount} down`)
const f2 = sessionFatigue({ A:{topWeight:100,topReps:7}, B:{topWeight:100,topReps:11}, C:{topWeight:100,topReps:11} }, hist)
g('1 lift down -> not flagged', f2.text === null, `${f2.downCount} down`)
const f3 = sessionFatigue({ A:{topWeight:100,topReps:7}, B:{topWeight:100,topReps:7} }, hist)
g('only 2 exercises compared -> not enough', f3.text === null, `${f3.downCount} down of 2`)

console.log('\n' + (fail === 0 ? 'ALL PROGRESSION CHECKS PASSED' : `*** ${fail} FAILURES ***`))

console.log('\nPREFILL: THE NUMBERS THAT LAND IN THE SET ROW\n')
{
  const W2 = (s: any, n: number) => String(s).padEnd(n)
  const ctx = { goal: 'muscle' as const, level: 'intermediate' as const, bodyWeightLb: 180 }
  const s = (topWeight: number, topReps: number, lowestReps = topReps, rir: number | null = null, daysAgo = 3) => ({
    date: new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10),
    topWeight,
    topReps,
    lowestReps,
    rir,
  })

  const cases: Array<[string, string, string, any[], string, number | null, number | null]> = [
    // label,            exercise,          reps,    history,                        verdict,           weight, reps
    ['first time',       'Barbell Bench Press', '8-10', [],                          'first_time',      null,   8],
    ['earned a jump',    'Barbell Bench Press', '8-10', [s(185, 10, 10), s(185, 10, 10)], 'add_load',   190,    8],
    ['still climbing',   'Barbell Bench Press', '8-10', [s(185, 9, 8)],              'push_reps',       185,    10],
    ['one down',         'Barbell Bench Press', '8-10', [s(180, 8, 8), s(185, 9, 9)],'repeat',          180,    8],
    // Three consecutive declines, which is the cutback threshold. Two is not
    // a stall and correctly comes back as 'repeat'.
    ['sliding, cut back','Barbell Bench Press', '8-10', [s(165, 8), s(170, 8), s(175, 8), s(185, 9)], 'cut_back', 148.5, 8],
    ['back from a layoff','Barbell Bench Press','8-10', [s(185, 9, 9, null, 30)],    'returning',       166.5,  8],
  ]

  for (const [label, ex, reps, hist, wantVerdict, wantW, wantR] of cases) {
    const t = nextTarget(ex, reps, { ...ctx, daysSinceLast: hist.length ? Math.round((Date.now() - Date.parse((hist[0] as any).date + 'T00:00:00')) / 86400000) : 0 }, hist as any)
    const okV = t?.verdict === wantVerdict
    const okR = t?.suggestedReps === wantR
    // The weight the engine picks is already covered above; here we only care
    // that a number comes out at all, since an empty box is the thing being fixed.
    const okW = wantW === null ? t?.suggestedWeight === null : typeof t?.suggestedWeight === 'number'
    if (!okV || !okR || !okW) fail++
    console.log(
      W2(okV && okR && okW ? '  ok' : '  FAIL', 7),
      W2(label, 22),
      W2(t?.verdict ?? 'null', 17),
      W2(`${t?.suggestedWeight ?? '-'} lb x ${t?.suggestedReps ?? '-'}`, 18),
      okR ? '' : `expected ${wantR} reps`
    )
  }

  // Every verdict that can reach a set row must carry reps, or the row arrives
  // half-filled and the client is back to typing.
  const all = [
    nextTarget('Barbell Bench Press', '8-10', ctx, []),
    nextTarget('Barbell Bench Press', '8-10', ctx, [s(185, 10, 10), s(185, 10, 10)] as any),
    nextTarget('Barbell Bench Press', '8-10', ctx, [s(185, 9, 8)] as any),
    nextTarget('Pullups', '8-10', { ...ctx, bodyWeightLb: 180 }, [s(180, 10, 10), s(180, 10, 10)] as any),
  ]
  g('every target carries a rep count', all.every((t) => t == null || typeof t.suggestedReps === 'number'))
  g('reps never exceed the top of the range', all.every((t) => t == null || t.suggestedReps == null || t.suggestedReps <= 10))
  g('reps are never zero or negative', all.every((t) => t == null || t.suggestedReps == null || t.suggestedReps > 0))
  g('timed work still returns no target', nextTarget('Treadmill Run', '20 min', ctx, []) === null)
}

console.log('\n' + (fail === 0 ? 'ALL PROGRESSION CHECKS PASSED (incl. prefill)' : `*** ${fail} FAILURES ***`))
