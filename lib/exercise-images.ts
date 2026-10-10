/**
 * Where exercise demonstration images actually come from.
 *
 * They were never deployed. `public/exercises/images/` is in .gitignore —
 * "too large for git", downloaded by scripts/download-exercises.mjs — and
 * nothing on Vercel runs that script, so every one of the 1,746 paths stored
 * in exercises.json has been a 404 in production since the day it shipped.
 * Confirmed against the live site, not inferred:
 *
 *   GET https://ajmfit.com/exercises/images/3_4_Sit-Up-0.jpg  →  404
 *
 * Which silently blanked the thumbnail on every exercise row in the program
 * preview, the exercise detail sheet, the library tab and the new builder's
 * picker. Nothing logged an error, because a broken <img> never does.
 *
 * So the images are served from the dataset they came from, via jsDelivr,
 * pinned to a commit rather than to a branch: a branch URL means an upstream
 * rename breaks every image at once with no warning and no deploy to blame.
 *
 * The dataset (yuhonas/free-exercise-db) is public domain.
 */

/** The upstream commit the paths are pinned to. Bump deliberately. */
export const EXERCISE_DB_COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5'

export const EXERCISE_IMAGE_BASE =
  `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${EXERCISE_DB_COMMIT}/exercises`

/**
 * The demo image for an exercise. Index 0 is the start position, 1 the end —
 * every one of the 873 records has exactly those two.
 *
 * `id` is the upstream directory name, which is why this is derivable at all:
 * the local paths flattened "3_4_Sit-Up/0.jpg" to "3_4_Sit-Up-0.jpg", and
 * splitting that back apart is guesswork for a name like
 * "Barbell_Bench_Press_-_Medium_Grip-0.jpg". The id avoids the guess.
 */
export function exerciseImageUrl(id: string, index: 0 | 1 = 0): string {
  return `${EXERCISE_IMAGE_BASE}/${id}/${index}.jpg`
}

/**
 * Rescue a legacy local path left in a cached copy of exercises.json.
 *
 * Browsers hold that file; a client whose cache still has the old paths would
 * otherwise see blank thumbnails until it expired. Returns null when the path
 * is not one of ours, so an already-absolute URL passes through untouched.
 */
export function exerciseImageFromLocalPath(path: string): string | null {
  const m = /^\/exercises\/images\/(.+)-([01])\.jpg$/.exec(path)
  if (!m) return null
  return exerciseImageUrl(m[1], Number(m[2]) as 0 | 1)
}

/** Normalise whatever is in an `images` array into something that loads. */
export function resolveExerciseImage(path: string | undefined | null): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return exerciseImageFromLocalPath(path)
}

/**
 * Fix up a library fetched from exercises.json.
 *
 * The file now holds absolute URLs, so for a fresh fetch this is a no-op. It
 * exists for the copy already sitting in a client's browser cache.
 */
export function normaliseLibraryImages<T extends { images: string[] }>(list: T[]): T[] {
  return list.map((e) => ({ ...e, images: e.images.map((p) => resolveExerciseImage(p) ?? p) }))
}
