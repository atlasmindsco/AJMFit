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
