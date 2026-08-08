'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

interface VideoManagerProps {
  exerciseName: string
  onSave?: () => void
}

export default function VideoManager({ exerciseName, onSave }: VideoManagerProps) {
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSaveVideo = async () => {
    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/exercises/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseName,
          youtubeUrl,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save video')
      }

      setSuccess(true)
      setYoutubeUrl('')
      onSave?.()

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save video')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3"
    >
      <h3 className="font-semibold text-sm text-gray-800">Add YouTube Demo</h3>

      <div className="space-y-2">
        <input
          type="text"
          value={youtubeUrl}
          onChange={(e) => {
            setYoutubeUrl(e.target.value)
            setError(null)
          }}
          placeholder="Paste YouTube URL (e.g., https://youtube.com/watch?v=...)"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
        />

        <p className="text-xs text-gray-600">
          💡 Search "{exerciseName}" on YouTube, copy the URL from your browser, and paste it here.
        </p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-red-50 border border-red-200 text-red-700 text-sm p-2 rounded"
        >
          {error}
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-green-50 border border-green-200 text-green-700 text-sm p-2 rounded"
        >
          ✅ Video saved! The demo will now show for this exercise.
        </motion.div>
      )}

      <button
        onClick={handleSaveVideo}
        disabled={loading || !youtubeUrl.trim()}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {loading ? 'Saving...' : 'Save Video Demo'}
      </button>
    </motion.div>
  )
}
