/**
 * The exercise demo images, checked against the real library and the real CDN.
 *
 * Worth a verifier because the previous arrangement was broken for months and
 * nothing noticed: a broken <img> logs nothing, renders a blank box, and looks
 * like a design choice. The only way to catch it is to ask for the bytes.
 */
import { readFileSync } from 'node:fs'
import {
  EXERCISE_DB_COMMIT,
  exerciseImageUrl,
  exerciseImageFromLocalPath,
  resolveExerciseImage,
  normaliseLibraryImages,
} from '../lib/exercise-images.ts'

const W = (s: any, n: number) => String(s).padEnd(n)
let fail = 0
const g = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail++
  console.log(W(ok ? '  ok' : '  FAIL', 7), W(label, 54), detail)
}

interface Rec { id: string; name: string; images: string[] }
const LIB: Rec[] = JSON.parse(
  readFileSync(new URL('../public/exercises/exercises.json', import.meta.url), 'utf8')
)

console.log('WHAT THE LIBRARY FILE SAYS\n')
{
  g('873 exercises load', LIB.length === 873, String(LIB.length))
  g('every one has two images', LIB.every((e) => e.images.length === 2))

  const local = LIB.filter((e) => e.images.some((p) => p.startsWith('/')))
  g('no local paths left', local.length === 0, local.length ? local[0].id : '')

  const wrong = LIB.filter((e) => e.images.some((p, i) => p !== exerciseImageUrl(e.id, i as 0 | 1)))
  g('every URL matches the builder', wrong.length === 0, wrong.length ? wrong[0].images[0] : '')

  g('all pinned to one commit', LIB.every((e) => e.images.every((p) => p.includes(EXERCISE_DB_COMMIT))))

  // A branch URL is the failure mode this pin exists to prevent.
  g('not pinned to a branch', !LIB[0].images[0].includes('@main'))
}

console.log('\nRESCUING A CACHED COPY')
console.log('A browser holding the old exercises.json must not go blank.\n')
{
  g('flat local path reverses', exerciseImageFromLocalPath('/exercises/images/3_4_Sit-Up-0.jpg') === exerciseImageUrl('3_4_Sit-Up', 0))

  // The name that made guessing from the filename a bad idea: the directory
  // itself contains " - ", so splitting on the last hyphen is the only way.
  const hard = 'Barbell_Bench_Press_-_Medium_Grip'
  g('hyphenated id survives', exerciseImageFromLocalPath(`/exercises/images/${hard}-1.jpg`) === exerciseImageUrl(hard, 1), hard)

  g('index 1 kept as index 1', exerciseImageFromLocalPath('/exercises/images/Ab_Roller-1.jpg')!.endsWith('/1.jpg'))
  g('an absolute URL passes through', resolveExerciseImage('https://example.com/a.jpg') === 'https://example.com/a.jpg')
  g('a foreign path is refused', exerciseImageFromLocalPath('/covers/strength.jpg') === null)
  g('empty input is null, not ""', resolveExerciseImage('') === null && resolveExerciseImage(null) === null)

  const stale = [{ id: 'Ab_Roller', images: ['/exercises/images/Ab_Roller-0.jpg', '/exercises/images/Ab_Roller-1.jpg'] }]
  const fixed = normaliseLibraryImages(stale)
  g('a stale library normalises', fixed[0].images.every((p) => p.startsWith('https://')))
  g('normalising is non-destructive', stale[0].images[0].startsWith('/'))

  const fresh = normaliseLibraryImages([LIB[0]])
  g('a fresh library is unchanged', fresh[0].images[0] === LIB[0].images[0])
}

console.log('\nASKING THE CDN FOR THE BYTES')
console.log('Reaching the network, because that is the whole point.\n')
{
  // A spread across the alphabet plus the two awkward names: a leading digit
  // and an id carrying its own hyphens.
  const sample = [
    LIB[0],
    LIB.find((e) => e.id === 'Barbell_Bench_Press_-_Medium_Grip'),
    LIB.find((e) => e.id === 'Ab_Roller'),
    LIB[Math.floor(LIB.length / 2)],
    LIB[LIB.length - 1],
  ].filter(Boolean) as Rec[]

  for (const ex of sample) {
    const url = ex.images[0]
    try {
      const res = await fetch(url, { method: 'GET' })
      const bytes = res.ok ? (await res.arrayBuffer()).byteLength : 0
      g(
        `${ex.name.slice(0, 34)} loads`,
        res.ok && bytes > 1000 && (res.headers.get('content-type') ?? '').startsWith('image/'),
        `${res.status} ${bytes}b`
      )
    } catch (err) {
      g(`${ex.name.slice(0, 34)} loads`, false, String(err))
    }
  }

  // Five samples prove the scheme, not the catalogue. The pinned commit ships
  // its own manifest, so all 1,746 can be checked in one request instead of
  // 1,746 — and a single upstream rename would show up here as a miss.
  try {
    const upstream: Array<{ images?: string[] }> = await (
      await fetch(`https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${EXERCISE_DB_COMMIT}/dist/exercises.json`)
    ).json()
    const present = new Set(upstream.flatMap((e) => e.images ?? []))
    const base = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${EXERCISE_DB_COMMIT}/exercises/`
    const missing = LIB.flatMap((e) =>
      e.images.filter((u) => !u.startsWith(base) || !present.has(u.slice(base.length)))
    )
    g('all 1,746 exist at that commit', missing.length === 0, missing.length ? missing[0] : `${present.size} upstream`)
  } catch (err) {
    g('all 1,746 exist at that commit', false, String(err))
  }

  // And the old path really is gone, so this is not a fix for a non-problem.
  try {
    const res = await fetch('https://ajmfit.com/exercises/images/3_4_Sit-Up-0.jpg')
    g('the old local path 404s in prod', res.status === 404, String(res.status))
  } catch {
    g('the old local path 404s in prod', true, 'unreachable, skipped')
  }
}

console.log(fail === 0 ? '\nAll checks passed.' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
