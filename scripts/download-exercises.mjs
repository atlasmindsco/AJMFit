/**
 * Download exercises + images from free-exercise-db (public domain).
 * Source: https://github.com/yuhonas/free-exercise-db
 *
 * Usage:
 *   node scripts/download-exercises.mjs
 *
 * Re-runnable — skips images that already exist on disk.
 * No API key required.
 */

import { writeFile, mkdir, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')
const IMAGES_DIR = join(PROJECT_ROOT, 'public', 'exercises', 'images')
const JSON_PATH = join(PROJECT_ROOT, 'public', 'exercises', 'exercises.json')

const REPO_RAW = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main'
const EXERCISES_JSON_URL = `${REPO_RAW}/dist/exercises.json`
const CONCURRENCY = 8

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fileExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function downloadImage(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  await writeFile(destPath, buffer)
}

async function mapConcurrent(items, fn, concurrency) {
  const results = []
  let index = 0
  async function worker() {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return results
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await mkdir(IMAGES_DIR, { recursive: true })

  // 1. Fetch exercise catalog
  console.log('Fetching exercise catalog from free-exercise-db...')
  const res = await fetch(EXERCISES_JSON_URL)
  if (!res.ok) throw new Error(`Failed to fetch catalog: ${res.status}`)
  const allExercises = await res.json()
  console.log(`Found ${allExercises.length} exercises`)

  // 2. Download images (2 per exercise: start + end position)
  let downloaded = 0
  let skipped = 0
  let failed = 0

  const imageJobs = allExercises.flatMap((ex) =>
    (ex.images || []).map((imgPath) => ({
      exercise: ex,
      imgPath,
      // e.g. "Ab_Roller/0.jpg" → "Ab_Roller-0.jpg"
      localName: imgPath.replace('/', '-'),
      url: `${REPO_RAW}/exercises/${imgPath}`,
    }))
  )

  console.log(`Downloading ${imageJobs.length} images (${CONCURRENCY} concurrent)...`)

  await mapConcurrent(
    imageJobs,
    async (job, i) => {
      const destPath = join(IMAGES_DIR, job.localName)

      if (await fileExists(destPath)) {
        skipped++
        return
      }

      try {
        await downloadImage(job.url, destPath)
        downloaded++
        if (downloaded % 50 === 0) {
          console.log(`  ${downloaded} downloaded, ${skipped} skipped (${i + 1}/${imageJobs.length})`)
        }
      } catch (err) {
        failed++
        console.warn(`  FAILED ${job.localName}: ${err.message}`)
      }
    },
    CONCURRENCY,
  )

  console.log(`Images done — ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`)

  // 3. Write cleaned JSON with local image paths
  const cleaned = allExercises.map((ex) => ({
    id: ex.id,
    name: ex.name,
    force: ex.force || null,
    level: ex.level || 'beginner',
    mechanic: ex.mechanic || null,
    equipment: ex.equipment || 'body only',
    primaryMuscles: ex.primaryMuscles || [],
    secondaryMuscles: ex.secondaryMuscles || [],
    instructions: ex.instructions || [],
    category: ex.category || 'strength',
    images: (ex.images || []).map((p) => `/exercises/images/${p.replace('/', '-')}`),
  }))

  await writeFile(JSON_PATH, JSON.stringify(cleaned, null, 2))
  console.log(`Wrote ${cleaned.length} exercises to ${JSON_PATH}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
