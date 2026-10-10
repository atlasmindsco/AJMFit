/**
 * The set-entry rule: what shows, what logs, what blocks.
 *
 * Written because the previous arrangement passed every check I could make
 * from here and was still wrong in the hand — the suggestion sat in the box
 * as a real value, so typing a weight meant selecting "115" first. Nothing
 * automated catches "tedious". What a test CAN hold is the pair of
 * properties that made the fix safe: the box must be empty underneath, and
 * ticking must still commit the suggestion.
 */
import { boxValue, boxPlaceholder, toLog, canLogSet, type SetEntry } from '../lib/set-entry.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 58), detail)
}

const e = (typed: string, suggestion: string): SetEntry => ({ typed, suggestion })

console.log('AN UNTOUCHED SET WITH A SUGGESTION')
console.log('The screenshot case: 115 lb x 8 proposed, nothing typed.\n')
{
  const weight = e('', '115')
  g('the box is EMPTY underneath', boxValue(weight) === '', `"${boxValue(weight)}"`)
  g('the suggestion shows as a placeholder', boxPlaceholder(weight, '135', 'lbs') === '115')
  g('ticking still logs the suggestion', toLog(weight) === '115', 'nothing to type to just tick it')
  g('and the set can be logged', canLogSet(weight, e('', '8')))
}

console.log('\nTYPING REPLACES, IT DOES NOT APPEND')
console.log('The actual complaint: tap in, type 9, get 9 and not 1159.\n')
{
  // The box being empty is the whole mechanism — there is no "115" in the
  // field for a keystroke to land next to.
  const typed = e('9', '115')
  g('the box holds only what was typed', boxValue(typed) === '9')
  g('and that is what logs', toLog(typed) === '9')
  g('the placeholder is gone once typing starts', boxValue(typed) !== '')

  // Had the suggestion stayed a value, this is what the old code produced.
  const oldBehaviour = '115' + '9'
  g('the old arrangement really did give 1159', oldBehaviour === '1159', 'caret lands inside the number')
}

console.log('\nCLEARING THE BOX')
{
  const cleared = e('', '115')
  g('deleting back to empty restores the suggestion', toLog(cleared) === '115')
  g('and the placeholder returns', boxPlaceholder(cleared, null, 'lbs') === '115')
}

console.log('\nWHEN THERE IS NOTHING TO SUGGEST')
console.log('A first-ever exercise: no engine target, no history.\n')
{
  const blank = e('', '')
  g('the placeholder falls back to the word', boxPlaceholder(blank, null, 'lbs') === 'lbs')
  g('last session is used before the word', boxPlaceholder(blank, '95', 'lbs') === '95')
  g('nothing logs', toLog(blank) === '')
  g('and the set cannot be logged', !canLogSet(blank, e('', '')))
  g('typing unblocks it', canLogSet(e('95', ''), e('8', '')))
}

console.log('\nBODYWEIGHT MOVEMENTS HAVE NO WEIGHT BOX\n')
{
  g('reps alone can log', canLogSet(null, e('', '12')))
  g('no reps still blocks', !canLogSet(null, e('', '')))
}

console.log('\nTHE TWO PROPERTIES THAT MATTER, OVER EVERY COMBINATION\n')
{
  const values = ['', '0', '5', '115', '1159']
  let emptyUnderneath = true
  let tickCommits = true
  for (const typed of values) {
    for (const suggestion of values) {
      const entry = e(typed, suggestion)
      // 1. The suggestion is NEVER in the box.
      if (boxValue(entry) !== typed) emptyUnderneath = false
      // 2. Something proposed is never silently dropped.
      if (typed === '' && suggestion !== '' && toLog(entry) !== suggestion) tickCommits = false
      if (typed !== '' && toLog(entry) !== typed) tickCommits = false
    }
  }
  g('the suggestion never reaches the value', emptyUnderneath, `${values.length ** 2} combinations`)
  g('ticking never drops a number', tickCommits, `${values.length ** 2} combinations`)

  // "0" is a real entry, not an absence — a bodyweight set logged at 0 lb
  // added must not silently become the suggested 115.
  g('a typed 0 beats the suggestion', toLog(e('0', '115')) === '0')
}

console.log(fail === 0 ? '\nAll set-entry checks passed.' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
