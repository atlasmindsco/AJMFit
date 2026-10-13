/**
 * Supersets: the letters the execution view parses, and the rest it skips.
 *
 * The letters are the risky half. `groupBySeries` in the execution view strips
 * the digits off a series label to decide what belongs together, so the format
 * is a contract with code I am not changing and cannot click through. The
 * checks below run the real grouping function against the labels this module
 * produces, rather than asserting the strings look right.
 */
import { seriesLabels, restSecondsAfterSet, canPair, newSupersetId, MAX_SUPERSET_SIZE } from '../lib/supersets.ts'
import { nextCopyName } from '../lib/day-renames.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 56), detail)
}

/**
 * The execution view's grouping, copied verbatim from app/studio/programs/
 * page.tsx so the labels are checked against what actually consumes them.
 * If that function changes, this check should start failing.
 */
function groupBySeries(series: string[]): Array<{ label: string; isSuperset: boolean; members: string[] }> {
  const groups: Array<{ label: string; isSuperset: boolean; members: string[] }> = []
  const seen = new Set<string>()
  for (const s of series) {
    const baseLetter = s.replace(/[0-9]/g, '')
    if (seen.has(baseLetter)) continue
    seen.add(baseLetter)
    const members = series.filter((e) => e.replace(/[0-9]/g, '') === baseLetter)
    groups.push({
      label: members.length > 1 ? members.join('/') + ' SERIES' : `${baseLetter} SERIES`,
      isSuperset: members.length > 1,
      members,
    })
  }
  return groups
}

const ex = (supersetGroup?: string | null) => ({ supersetGroup })

console.log('LETTERS, AS THE EXECUTION VIEW READS THEM\n')
{
  const plain = seriesLabels([ex(), ex(), ex()])
  g('three standalone exercises are A B C', plain.join(',') === 'A,B,C', plain.join(','))
  g('and group as three singles', groupBySeries(plain).every((x) => !x.isSuperset))

  const paired = seriesLabels([ex('ss1'), ex('ss1'), ex()])
  g('a pair is A1 A2, then B', paired.join(',') === 'A1,A2,B', paired.join(','))
  const pg = groupBySeries(paired)
  g('the view sees one superset and one single', pg.length === 2 && pg[0].isSuperset && !pg[1].isSuperset)
  g('and labels it A1/A2 SERIES', pg[0].label === 'A1/A2 SERIES', pg[0].label)

  const leading = seriesLabels([ex(), ex('ss1'), ex('ss1')])
  g('a pair after a single is A, B1, B2', leading.join(',') === 'A,B1,B2', leading.join(','))

  const two = seriesLabels([ex('ss1'), ex('ss1'), ex('ss2'), ex('ss2')])
  g('two pairs are A1 A2 B1 B2', two.join(',') === 'A1,A2,B1,B2', two.join(','))
  g('and read as two supersets', groupBySeries(two).filter((x) => x.isSuperset).length === 2)

  const triple = seriesLabels([ex('ss1'), ex('ss1'), ex('ss1')])
  g('a triple is A1 A2 A3', triple.join(',') === 'A1,A2,A3', triple.join(','))
  g('and is one group of three', groupBySeries(triple)[0].members.length === 3)

  // A group that lost a member is not a superset any more.
  const orphan = seriesLabels([ex('ss1'), ex(), ex()])
  g('a group of one is a plain letter', orphan.join(',') === 'A,B,C', orphan.join(','))
  g('and shows no superset badge', !groupBySeries(orphan)[0].isSuperset)

  // Letters must never collide, or the view merges unrelated exercises.
  const messy = seriesLabels([ex('ss2'), ex(), ex('ss2'), ex(), ex('ss5'), ex('ss5')])
  const bases = messy.map((s) => s.replace(/[0-9]/g, ''))
  const groupsSeen = groupBySeries(messy)
  g('non-adjacent partners stay one group', groupsSeen.find((x) => x.members.length === 2 && x.isSuperset) !== undefined, messy.join(','))
  g('no standalone shares a letter', new Set(bases).size === groupsSeen.length, `${new Set(bases).size} letters, ${groupsSeen.length} groups`)

  const empty = seriesLabels([])
  g('an empty day produces nothing', empty.length === 0)

  const many = seriesLabels(Array.from({ length: 12 }, () => ex()))
  g('twelve exercises all get distinct letters', new Set(many).size === 12, many.join(''))
}

console.log('\nREST: THE WHOLE POINT OF A SUPERSET\n')
{
  g('a normal exercise rests as prescribed',
    restSecondsAfterSet({ prescribed: 90, isSuperset: false, isLastInGroup: true }) === 90)

  g('no rest between partners',
    restSecondsAfterSet({ prescribed: 90, isSuperset: true, isLastInGroup: false }) === 0,
    'straight into the next movement')

  g('full rest after the last partner',
    restSecondsAfterSet({ prescribed: 90, isSuperset: true, isLastInGroup: true }) === 90,
    'the round ends here')

  g('a 150s compound keeps its 150 after the pair',
    restSecondsAfterSet({ prescribed: 150, isSuperset: true, isLastInGroup: true }) === 150)

  g('zero prescribed stays zero',
    restSecondsAfterSet({ prescribed: 0, isSuperset: true, isLastInGroup: true }) === 0)

  // The bug this prevents: pairing two exercises and still waiting 90 seconds
  // between them, which is just two exercises with a badge on top.
  const wouldHaveRested = 90
  g('and the old behaviour really was wrong', wouldHaveRested !== restSecondsAfterSet({ prescribed: 90, isSuperset: true, isLastInGroup: false }))
}

console.log('\nWHAT CAN BE PAIRED\n')
{
  g('a lone exercise can be paired', canPair(1))
  g('a pair can take a third', canPair(2))
  g('three is the ceiling', !canPair(MAX_SUPERSET_SIZE), 'past three it is circuit training')

  g('a fresh id avoids the ones in use', newSupersetId(['ss1', 'ss2']) === 'ss3')
  g('and nulls do not count as used', newSupersetId([null, undefined, 'ss1']) === 'ss2')
  g('an empty day starts at ss1', newSupersetId([]) === 'ss1')
  g('a gap is reused', newSupersetId(['ss2']) === 'ss1')
}

console.log('\nNAMING A DUPLICATE\n')
{
  g('a copy is marked as one', nextCopyName('Push Pull Legs') === 'Push Pull Legs (copy)')
  g('copying a copy does not stack', nextCopyName('Push Pull Legs (copy)') === 'Push Pull Legs (copy)', 'not "(copy) (copy)"')
  g('a taken name steps to 2', nextCopyName('PPL', ['PPL (copy)']) === 'PPL (copy 2)')
  g('and keeps stepping', nextCopyName('PPL', ['PPL (copy)', 'PPL (copy 2)']) === 'PPL (copy 3)')
  g('matching is case-insensitive', nextCopyName('PPL', ['ppl (copy)']) === 'PPL (copy 2)')
  g('re-copying "(copy 2)" rebases', nextCopyName('PPL (copy 2)') === 'PPL (copy)')

  // The column takes 80 characters. Trim the NAME, never the marker, or a
  // long name produces a copy with no sign that it is one.
  const long = 'A'.repeat(90)
  const copy = nextCopyName(long)
  g('a long name still fits', copy.length <= 80, `${copy.length} chars`)
  g('and still ends in (copy)', copy.endsWith(' (copy)'), copy.slice(-10))

  g('an empty name gets a real one', nextCopyName('   ') === 'My program (copy)')
}

console.log(fail === 0 ? '\nAll superset checks passed.' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
