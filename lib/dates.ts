/**
 * Calendar dates in the client's own timezone.
 *
 * `new Date().toISOString().slice(0, 10)` gives the UTC date, which is not the
 * date the person is living in. For anyone west of Greenwich it rolls over
 * early — at 8pm Eastern it is already tomorrow in UTC — so a nutrition day
 * would reset mid-evening and everything logged since midnight would vanish
 * from view while dinner was still being eaten.
 *
 * The rows were never lost; they were filed under the next day and the query
 * asked for the wrong one. Every date written to or read from a day-keyed
 * table should come from here.
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** YYYY-MM-DD in local time. */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local date N days before the given day. */
export function localDateDaysAgo(days: number, from: Date = new Date()): string {
  const d = new Date(from)
  d.setDate(d.getDate() - days)
  return localDate(d)
}

/** Monday of the week containing `d`, in local time. */
export function localWeekStart(d: Date = new Date()): string {
  const t = new Date(d)
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7))
  return localDate(t)
}
