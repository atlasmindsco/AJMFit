/**
 * Exercise video demonstrations service
 * Fetches videos from ExerciseDB and manages local cache
 */

import { supabase } from '@/lib/supabase'

const db = supabase as any

export interface ExerciseVideo {
  id?: string
  exerciseName: string
  videoUrl?: string
  videoSource: 'exercisedb' | 'youtube' | 'custom'
  thumbnailUrl?: string
  instructions?: string[]
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  primaryMuscle?: string
  secondaryMuscles?: string[]
  equipment?: string
}

/**
 * Fetch exercise video from ExerciseDB via RapidAPI
 * Returns video URL and exercise details
 */
export async function fetchExerciseFromDB(exerciseName: string): Promise<ExerciseVideo | null> {
  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) {
    console.error('RAPIDAPI_KEY not configured')
    return null
  }

  try {
    const response = await fetch(
      `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(exerciseName.toLowerCase())}`,
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
        },
      }
    )

    if (!response.ok) {
      console.log(`Exercise not found in ExerciseDB: ${exerciseName}`)
      return null
    }

    const data = await response.json()
    if (!Array.isArray(data) || data.length === 0) {
      return null
    }

    const exercise = data[0]

    return {
      exerciseName: exercise.name || exerciseName,
      videoUrl: exercise.gifUrl, // ExerciseDB provides GIF or video URL
      videoSource: 'exercisedb',
      thumbnailUrl: exercise.gifUrl,
      instructions: exercise.instructions || [],
      difficulty: exercise.difficulty || 'intermediate',
      primaryMuscle: exercise.target,
      secondaryMuscles: exercise.secondaryMuscles || [],
      equipment: exercise.equipment || 'Bodyweight',
    }
  } catch (error) {
    console.error(`Error fetching exercise from DB: ${exerciseName}`, error)
    return null
  }
}

/**
 * Get exercise video from database, or fetch from ExerciseDB if not cached
 */
export async function getExerciseVideo(exerciseName: string): Promise<ExerciseVideo | null> {
  // First check database cache
  const { data: cached } = await db
    .from('exercise_videos')
    .select('*')
    .eq('exercise_name', exerciseName)
    .maybeSingle()

  if (cached) {
    return {
      id: cached.id,
      exerciseName: cached.exercise_name,
      videoUrl: cached.video_url,
      videoSource: cached.video_source,
      thumbnailUrl: cached.thumbnail_url,
      instructions: cached.instructions,
      difficulty: cached.difficulty,
      primaryMuscle: cached.primary_muscle,
      secondaryMuscles: cached.secondary_muscles,
      equipment: cached.equipment,
    }
  }

  // If not cached, fetch from ExerciseDB
  const video = await fetchExerciseFromDB(exerciseName)

  // Cache the result
  if (video) {
    await saveExerciseVideo(video)
  }

  return video
}

/**
 * Save exercise video to database cache
 */
export async function saveExerciseVideo(video: ExerciseVideo): Promise<void> {
  const { error } = await db.from('exercise_videos').upsert({
    exercise_name: video.exerciseName,
    video_url: video.videoUrl,
    video_source: video.videoSource,
    thumbnail_url: video.thumbnailUrl,
    instructions: video.instructions || [],
    difficulty: video.difficulty,
    primary_muscle: video.primaryMuscle,
    secondary_muscles: video.secondaryMuscles || [],
    equipment: video.equipment,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error('Error saving exercise video:', error)
  }
}

/**
 * Update video with YouTube link (manual override)
 */
export async function setYouTubeVideo(
  exerciseName: string,
  youtubeUrl: string,
  thumbnail?: string
): Promise<void> {
  // Extract video ID if full URL provided
  const videoId = youtubeUrl.includes('youtube.com') || youtubeUrl.includes('youtu.be')
    ? youtubeUrl.split('v=')[1]?.split('&')[0] || youtubeUrl.split('/').pop()
    : youtubeUrl

  const embedUrl = `https://www.youtube.com/embed/${videoId}`
  const thumbnailUrl = thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

  await saveExerciseVideo({
    exerciseName,
    videoUrl: embedUrl,
    videoSource: 'youtube',
    thumbnailUrl,
  })
}

/**
 * Batch fetch videos for multiple exercises
 */
export async function getMultipleExerciseVideos(exerciseNames: string[]): Promise<Record<string, ExerciseVideo>> {
  const videos: Record<string, ExerciseVideo> = {}

  await Promise.all(
    exerciseNames.map(async (name) => {
      const video = await getExerciseVideo(name)
      if (video) {
        videos[name] = video
      }
    })
  )

  return videos
}

/**
 * Get all cached exercises with videos
 */
export async function getAllCachedVideos(): Promise<ExerciseVideo[]> {
  const { data } = await db
    .from('exercise_videos')
    .select('*')
    .order('exercise_name', { ascending: true })

  return (data || []).map((row: any) => ({
    id: row.id,
    exerciseName: row.exercise_name,
    videoUrl: row.video_url,
    videoSource: row.video_source,
    thumbnailUrl: row.thumbnail_url,
    instructions: row.instructions,
    difficulty: row.difficulty,
    primaryMuscle: row.primary_muscle,
    secondaryMuscles: row.secondary_muscles,
    equipment: row.equipment,
  }))
}

/**
 * Delete cached video (forces refetch on next request)
 */
export async function clearExerciseVideoCache(exerciseName: string): Promise<void> {
  const { error } = await db.from('exercise_videos').delete().eq('exercise_name', exerciseName)

  if (error) {
    console.error('Error clearing cache:', error)
  }
}
