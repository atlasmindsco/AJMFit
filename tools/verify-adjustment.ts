import { decideAdjustment, type AdjustmentInputs } from '../lib/nutrition-adjustment.ts'

const BASE: AdjustmentInputs = {
  currentAvgWeight: 200, priorAvgWeight: 202, daysBetween: 14, weighInsInWindow: 5, priorWeighInsInWindow: 5,
  currentCalories: 2300, maintenanceCalories: 2900, bmr: 1850,
  sex: 'male', goal: 'lose_fat', currentWeight: 200, goalWeight: 175,
  targetRatePctPerWeek: -0.65,
  adherence: 5, hunger: 2, energy: 4, sleep: 4, trainingPerformance: 4, waistChangeIn: null,
  daysSinceLastChange: 30, priorSlowPeriods: 0, priorStrainPeriods: 0, weeksInDeficit: 4,
  medicationFlag: false, coached: true,
}
const W=(s:any,n:number)=>String(s).padEnd(n)
let fail = 0
const check = (label: string, over: Partial<AdjustmentInputs>, expect: string, expectEsc?: string|null) => {
  const r = decideAdjustment({ ...BASE, ...over })
  const ok = r.verdict === expect && (expectEsc === undefined || r.escalation === expectEsc)
  if (!ok) fail++
  console.log(W(ok?'  ok':'  FAIL',7), W(label,42), W(r.verdict,18),
    W(r.newCalories ?? '-',6), W(r.escalation ?? '-',26), ok?'':`expected ${expect}/${expectEsc}`)
}

console.log('VERDICTS\n')
check('on target', {}, 'hold')
check('not enough days', { daysBetween: 7 }, 'insufficient_data')
check('too few weigh-ins', { weighInsInWindow: 1 }, 'insufficient_data')
 check('weekly check-in only (2+2)', { weighInsInWindow: 2, priorWeighInsInWindow: 2 }, 'hold')
 check('prior window empty', { priorWeighInsInWindow: 1 }, 'insufficient_data')
check('medication declared', { medicationFlag: true }, 'escalate', 'medication_flag')
check('losing far too fast', { currentAvgWeight: 195, priorAvgWeight: 202 }, 'escalate', 'rapid_loss')
check('gaining while cutting', { currentAvgWeight: 203, priorAvgWeight: 202 }, 'escalate', 'gaining_in_deficit')
check('hunger 5, 2nd period', { hunger: 5, priorStrainPeriods: 1 }, 'escalate', 'hunger_energy')
check('energy 1, 2nd period', { energy: 1, priorStrainPeriods: 1 }, 'escalate', 'hunger_energy')
check('adherence collapse repeated', { adherence: 2, priorSlowPeriods: 1 }, 'escalate', 'adherence_collapse')
check('training tanking while cutting', { trainingPerformance: 2 }, 'escalate', 'performance_drop')
check('poor adherence -> hold, not cut', { adherence: 3 }, 'adherence_first')
check('12 weeks deficit -> break', { weeksInDeficit: 12 }, 'diet_break')
check('changed 5 days ago', { daysSinceLastChange: 5 }, 'hold')
check('scale flat, waist down', { currentAvgWeight: 202, waistChangeIn: -0.5 }, 'hold')
check('too slow -> cut', { currentAvgWeight: 201.6, priorAvgWeight: 202 }, 'decrease')
check('3rd slow period -> escalate', { currentAvgWeight: 201.6, priorAvgWeight: 202, priorSlowPeriods: 2 }, 'escalate', 'stalled_despite_adherence')
check('clearly too fast -> raise cals', { currentAvgWeight: 197.5, priorAvgWeight: 202 }, 'increase')
check('bulking on target', { goal: 'build_muscle', targetRatePctPerWeek: 0.12, currentAvgWeight: 200.7, priorAvgWeight: 200 }, 'hold')
check('bulking too fast -> cut surplus', { goal: 'build_muscle', targetRatePctPerWeek: 0.12, currentAvgWeight: 202.5, priorAvgWeight: 200 }, 'decrease')

console.log('\nGUARDRAILS\n')
const g = (label: string, over: Partial<AdjustmentInputs>, test: (r: ReturnType<typeof decideAdjustment>) => boolean, detail: (r:any)=>string) => {
  const r = decideAdjustment({ ...BASE, ...over })
  const ok = test(r); if (!ok) fail++
  console.log(W(ok?'  ok':'  FAIL',7), W(label,42), detail(r))
}
g('cut never breaches floor', { currentCalories: 1900, bmr: 1850, currentAvgWeight: 201.6, priorAvgWeight: 202 },
  r => r.newCalories === null || r.newCalories >= 1850, r => `new=${r.newCalories} floor=1850`)
g('step never exceeds 10%', { currentAvgWeight: 201.9, priorAvgWeight: 202 },
  r => r.newCalories === null || Math.abs(r.newCalories - 2300) <= 230, r => `delta=${r.newCalories ? r.newCalories-2300 : 0}`)
g('coached needs approval', { currentAvgWeight: 201.6, priorAvgWeight: 202, coached: true },
  r => r.requiresApproval === true, r => `requiresApproval=${r.requiresApproval}`)
g('blueprint auto-applies', { currentAvgWeight: 201.6, priorAvgWeight: 202, coached: false },
  r => r.requiresApproval === false, r => `requiresApproval=${r.requiresApproval}`)
g('escalation always needs a human', { medicationFlag: true, coached: false },
  r => r.requiresApproval === true, r => `requiresApproval=${r.requiresApproval}`)
g('macros recomputed on change', { currentAvgWeight: 201.6, priorAvgWeight: 202 },
  r => r.newProtein !== null && r.newCarbs !== null && r.newFats !== null,
  r => `p=${r.newProtein} c=${r.newCarbs} f=${r.newFats}`)
g('macros sum to new calories', { currentAvgWeight: 201.6, priorAvgWeight: 202 },
  r => r.newCalories === null || Math.abs((r.newProtein!*4 + r.newCarbs!*4 + r.newFats!*9) - r.newCalories) <= 12,
  r => `sum=${r.newProtein!*4 + r.newCarbs!*4 + r.newFats!*9} target=${r.newCalories}`)
g('already at floor, still slow', { currentCalories: 1850, bmr: 1850, currentAvgWeight: 201.9, priorAvgWeight: 202 },
  r => r.verdict === 'hold' && r.escalation === 'stalled_despite_adherence',
  r => `${r.verdict}/${r.escalation}`)
g('adherence gate beats slow rate', { adherence: 3, currentAvgWeight: 201.9, priorAvgWeight: 202 },
  r => r.verdict === 'adherence_first' && r.newCalories === null, r => `${r.verdict} new=${r.newCalories}`)
g('every result has a client reason', {}, r => r.reason.length > 20, r => `${r.reason.length} chars`)

console.log('\n' + (fail === 0 ? 'ALL ADJUSTMENT CHECKS PASSED' : `*** ${fail} FAILURES ***`))

// Regression: a bulking client gaining too fast must have calories REMOVED.
// The first version derived the calorie direction from the "too fast" label,
// which is sign-flipped for a bulk, and handed them more food.
const bulkFast = decideAdjustment({ ...BASE, goal: 'build_muscle', targetRatePctPerWeek: 0.12,
  currentAvgWeight: 202.5, priorAvgWeight: 200, currentCalories: 3000 })
console.log('\nREGRESSION: bulking too fast')
console.log(`  verdict=${bulkFast.verdict} cals 3000 -> ${bulkFast.newCalories}`,
  bulkFast.newCalories !== null && bulkFast.newCalories < 3000 ? ' ok' : '  *** FAIL: should go DOWN ***')
const cutFast = decideAdjustment({ ...BASE, currentAvgWeight: 197.5, priorAvgWeight: 202 })
console.log('REGRESSION: cutting too fast')
console.log(`  verdict=${cutFast.verdict} cals 2300 -> ${cutFast.newCalories}`,
  cutFast.newCalories !== null && cutFast.newCalories > 2300 ? ' ok' : '  *** FAIL: should go UP ***')
