'use client'

import { useState } from 'react'

export default function SimpleTestPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const test = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/test-simple', { method: 'POST' })
      const data = await res.json()
      setResult(data)
    } catch (err: any) {
      setResult({ error: err.message })
    }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Simple Database Test</h1>

      <button
        onClick={test}
        disabled={loading}
        className="px-6 py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 disabled:opacity-50 mb-6"
      >
        {loading ? 'Testing...' : 'Test Now'}
      </button>

      {result && (
        <div className="bg-gray-900 text-white p-4 rounded font-mono text-sm overflow-auto">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      {result?.success && (
        <div className="mt-4 p-4 bg-green-100 text-green-800 rounded">
          ✓ Database write is working!
        </div>
      )}

      {result?.error && (
        <div className="mt-4 p-4 bg-red-100 text-red-800 rounded">
          ✗ Error: {result.error}
        </div>
      )}
    </div>
  )
}
