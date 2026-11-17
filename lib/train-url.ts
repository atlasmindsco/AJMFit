/**
 * Where you are inside the Train tab, written down in the address bar.
 *
 * THE PROBLEM THIS SOLVES. /studio/programs holds six screens — the week, a
 * day, one exercise, the builder, your saved programs, and the chooser that
 * leads to them — and until now it switched between them with a variable in
 * memory. The address never changed. So as far as the phone was concerned all
 * six were the same page, and the back gesture, which is how people actually
 * navigate, did not go back a screen: it left the Train tab altogether, from
 * anywhere, including the middle of a workout. A reload did the same thing in
 * reverse, dropping you at the week with no idea where you had been.
 *
 * Writing the place into the address fixes both at once, because the browser
 * already knows how to do this and we were simply not telling it anything.
 *
 * DELIBERATELY NOT real Next.js routes. Splitting the page into
 * /train/day/[n] and friends would mean breaking up a 4,700-line component
 * that shares a great deal of loaded state — history, swaps, personal
 * records, an open session — across all six screens. The query string gets
 * the whole user-visible benefit (back works, reload works, a link to a day
 * works) at a fraction of the risk.
 */

export type TrainView = 'preview' | 'workout' | 'exercise' | 'builder' | 'myPrograms' | 'startFrom'

export interface TrainPlace {
  view: TrainView
  /** Index into the weekly plan, for the day and exercise screens. */
  day: number | null
  /** Exercise name, for the exercise screen. */
  exercise: string | null
}

export const HOME_PLACE: TrainPlace = {
  view: 'preview',
  day: null,
  exercise: null,
}

const VIEWS: TrainView[] = ['preview', 'workout', 'exercise', 'builder', 'myPrograms', 'startFrom']

/**
 * The address for a place, as a query string including the leading "?".
 *
 * Only what is needed to rebuild the screen. The week with the overview tab
 * open is the default, so it gets a bare path — a client who lands on
 * /studio/programs from the nav should not immediately see a query string
 * appear for having changed nothing.
 */
export function placeToQuery(place: TrainPlace): string {
  const q = new URLSearchParams()

  if (place.view !== 'preview') q.set('view', place.view)

  // The day only means something on the two screens that show one, and
  // carrying it elsewhere would make the builder's address change every time
  // somebody had previously opened a different day.
  if ((place.view === 'workout' || place.view === 'exercise') && place.day !== null) {
    q.set('day', String(place.day))
  }
  if (place.view === 'exercise' && place.exercise) q.set('ex', place.exercise)

  const s = q.toString()
  return s ? `?${s}` : ''
}

/**
 * Read a place back out of an address.
 *
 * Tolerant on purpose: anything unrecognised falls back to the week rather
 * than erroring, because this parses whatever is in the address bar — an old
 * bookmark, a shared link, a hand-edited URL.
 *
 * `?day=2` with no view is the dashboard's "Start Workout" link, which has
 * always meant "open that day's session", so it keeps meaning that.
 */
export function queryToPlace(search: string): TrainPlace {
  const q = new URLSearchParams(search)

  // Read the string before converting it. `Number(null)` is 0 and so is
  // `Number('')`, so converting first turns "no day in the address" into
  // "day zero" — which made a bare /studio/programs open the first day's
  // session instead of the week.
  const rawDay = q.get('day')
  const dayNum = rawDay === null || rawDay.trim() === '' ? NaN : Number(rawDay)
  const day = Number.isInteger(dayNum) && dayNum >= 0 ? dayNum : null

  const rawView = q.get('view')
  let view: TrainView = 'preview'
  if (rawView && VIEWS.indexOf(rawView as TrainView) !== -1) view = rawView as TrainView
  else if (day !== null) view = 'workout'

  // A day screen with no day, or an exercise screen with no exercise, cannot
  // be drawn. Fall back rather than render an empty shell.
  if ((view === 'workout' || view === 'exercise') && day === null) view = 'preview'
  const exercise = view === 'exercise' ? q.get('ex') : null
  if (view === 'exercise' && !exercise) view = 'workout'

  // A `tab` parameter may still arrive from a link saved while the week had
  // Overview and Program sub-tabs. It is ignored rather than rejected: the
  // address still points at the week, which is where that link meant to go.
  return { view, day: view === 'preview' ? null : day, exercise }
}

/** True when two places would draw the same screen. */
export function samePlace(a: TrainPlace, b: TrainPlace): boolean {
  return placeToQuery(a) === placeToQuery(b)
}
