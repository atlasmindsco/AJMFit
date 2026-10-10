/**
 * Working out which days were renamed, and in what order to apply it.
 *
 * Separate from lib/custom-program.ts so it can be tested without a database
 * client — the same split as builder-rules against the builder itself. The
 * decisions here are the ones worth getting right: workout rows store a day's
 * NAME, the rotation matches on that name, and both a missed rename and a
 * mis-ordered one lose a client's history.
 */

export interface RenameableDay {
  name: string
  /** Database identity. Absent on a day that does not exist yet. */
  key?: string
}

export interface Rename {
  from: string
  to: string
}

/**
 * Which days were renamed between the draft as loaded and the draft as saved.
 *
 * Matched on `key`, not on position: a client who renames Day 2 and also drags
 * it to the end has done one rename, and comparing by index would report two.
 * Days without a key are new, and a key that has gone has been deleted —
 * neither is a rename.
 *
 * Compared case-sensitively after trimming, because "upper a" and "Upper A"
 * are a real rename as far as history is concerned: the rotation matches the
 * string exactly.
 */
export function renamesFor(original: RenameableDay[], edited: RenameableDay[]): Rename[] {
  const before = new Map<string, string>()
  for (const d of original) if (d.key) before.set(d.key, d.name.trim())

  const renames: Rename[] = []
  for (const d of edited) {
    if (!d.key) continue
    const was = before.get(d.key)
    const now = d.name.trim()
    if (was === undefined || was === now || !was || !now) continue
    renames.push({ from: was, to: now })
  }
  return renames
}

/**
 * Order a set of renames so that applying them one at a time is correct.
 *
 * Renames are applied as `update workouts set day_name = to where day_name =
 * from`, one name at a time, and the order matters more than it looks.
 * Renaming "Lower A" to "Upper A" before the old "Upper A" has moved out puts
 * two different days under one name, and the next update then sweeps up both
 * — two days' history merged, with nothing to merge it back from.
 *
 * So: emit a rename only once no other pending rename is still waiting to
 * vacate its target name. A straight swap of two names has no such order at
 * all, so one side goes out to a sentinel name and comes back at the end.
 *
 * Day names within a program are unique (canSave enforces it), which is what
 * makes this a permutation and therefore always solvable.
 */
export function planRenameOps(renames: Rename[]): Rename[] {
  const pending = renames.filter((r) => r.from && r.to && r.from !== r.to)
  const ops: Rename[] = []
  const deferred: Rename[] = []
  let sentinel = 0

  while (pending.length > 0) {
    const occupied = new Set(pending.map((r) => r.from))
    const i = pending.findIndex((r) => !occupied.has(r.to))
    if (i !== -1) {
      ops.push(pending[i])
      pending.splice(i, 1)
      continue
    }
    // Everything left is in a cycle. Park one name out of the way.
    const parked = pending.shift()!
    const tmp = `__ajmfit_renaming_${sentinel++}__`
    ops.push({ from: parked.from, to: tmp })
    deferred.push({ from: tmp, to: parked.to })
  }

  return [...ops, ...deferred]
}
