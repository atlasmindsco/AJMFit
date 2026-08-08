import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getExerciseVideo, setYouTubeVideo } from '@/lib/exercise-videos'

/**
 * GET: Fetch exercise video
 * POST: Save YouTube video link for an exercise
 * DELETE: Clear cached video
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const exerciseName = searchParams.get('name')

    if (!exerciseName) {
      return NextResponse.json({ error: 'Exercise name required' }, { status: 400 })
    }

    const video = await getExerciseVideo(exerciseName)
    return NextResponse.json({ video })
  } catch (error) {
    console.error('Error fetching exercise video:', error)
    return NextResponse.json({ error: 'Failed to fetch video' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Verify user is trainer
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const role = (user?.app_metadata as { role?: string } | undefined)?.role

    if (role !== 'trainer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await request.json()) as {
      exerciseName: string
      youtubeUrl: string
      thumbnail?: string
    }

    if (!body.exerciseName || !body.youtubeUrl) {
      return NextResponse.json(
        { error: 'Exercise name and YouTube URL required' },
        { status: 400 }
      )
    }

    await setYouTubeVideo(body.exerciseName, body.youtubeUrl, body.thumbnail)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error saving video:', error)
    return NextResponse.json({ error: 'Failed to save video' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    // Verify user is trainer
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const role = (user?.app_metadata as { role?: string } | undefined)?.role

    if (role !== 'trainer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const exerciseName = searchParams.get('name')

    if (!exerciseName) {
      return NextResponse.json({ error: 'Exercise name required' }, { status: 400 })
    }

    const admin = createClient() as any
    const { error } = await admin.from('exercise_videos').delete().eq('exercise_name', exerciseName)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting video:', error)
    return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 })
  }
}
