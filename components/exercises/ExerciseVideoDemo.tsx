'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getExerciseVideo, type ExerciseVideo } from '@/lib/exercise-videos'

interface ExerciseVideoDemoProps {
  exerciseName: string
  compact?: boolean
  showInstructions?: boolean
}

export default function ExerciseVideoDemo({
  exerciseName,
  compact = false,
  showInstructions = true,
}: ExerciseVideoDemoProps) {
  const [video, setVideo] = useState<ExerciseVideo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadVideo = async () => {
      try {
        setLoading(true)
        const data = await getExerciseVideo(exerciseName)
        setVideo(data)
      } catch (err) {
        setError('Failed to load video')
        console.error('Error loading exercise video:', err)
      } finally {
        setLoading(false)
      }
    }

    loadVideo()
  }, [exerciseName])

  if (loading) {
    return (
      <div
        className={`${
          compact ? 'h-32' : 'h-64'
        } bg-gray-100 rounded-lg flex items-center justify-center animate-pulse`}
      >
        <span className="text-gray-500">Loading demonstration...</span>
      </div>
    )
  }

  if (error || !video) {
    return (
      <div
        className={`${compact ? 'h-32' : 'h-64'} bg-gray-50 border border-gray-200 rounded-lg flex flex-col items-center justify-center p-4 text-center`}
      >
        <p className="text-sm text-gray-500">No demonstration video available</p>
        <p className="text-xs text-gray-400 mt-1">Try searching YouTube for "{exerciseName}"</p>
      </div>
    )
  }

  const isYouTube = video.videoSource === 'youtube' || video.videoUrl?.includes('youtube')
  const isGif = video.videoUrl?.endsWith('.gif')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-2"
    >
      {/* Video Container */}
      <div className={`bg-gray-900 rounded-lg overflow-hidden shadow-lg ${compact ? 'h-32' : 'h-64'}`}>
        {isYouTube ? (
          // YouTube Embed
          <iframe
            width="100%"
            height="100%"
            src={video.videoUrl}
            title={exerciseName}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        ) : isGif && video.videoUrl ? (
          // GIF/Video
          <img
            src={video.videoUrl}
            alt={exerciseName}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : video.thumbnailUrl ? (
          // Fallback to thumbnail
          <img
            src={video.thumbnailUrl}
            alt={exerciseName}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-gray-400 text-sm">Video unavailable</span>
          </div>
        )}
      </div>

      {/* Video Info */}
      {!compact && (
        <div className="space-y-2">
          {/* Exercise Details */}
          <div className="flex items-center justify-between text-sm">
            <div className="space-y-1">
              {video.primaryMuscle && (
                <p className="text-gray-700 font-medium">Target: {video.primaryMuscle}</p>
              )}
              {video.equipment && (
                <p className="text-gray-600 text-xs">Equipment: {video.equipment}</p>
              )}
            </div>
            {video.difficulty && (
              <span
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  video.difficulty === 'beginner'
                    ? 'bg-green-100 text-green-700'
                    : video.difficulty === 'intermediate'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-red-100 text-red-700'
                }`}
              >
                {video.difficulty.charAt(0).toUpperCase() + video.difficulty.slice(1)}
              </span>
            )}
          </div>

          {/* Instructions */}
          {showInstructions && video.instructions && video.instructions.length > 0 && (
            <div className="bg-gray-50 rounded p-3 border border-gray-200">
              <p className="text-xs font-semibold text-gray-800 mb-2">Form Tips:</p>
              <ul className="text-xs text-gray-700 space-y-1">
                {video.instructions.slice(0, 3).map((instruction, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="text-gray-400">•</span>
                    <span>{instruction}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Video Source Badge */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              📺 {video.videoSource === 'youtube' ? 'YouTube' : video.videoSource === 'exercisedb' ? 'ExerciseDB' : 'Custom'}
            </span>
            {video.videoSource === 'youtube' && video.videoUrl && (
              <a
                href={video.videoUrl.replace('/embed/', '/watch?v=')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700"
              >
                Open ↗
              </a>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
