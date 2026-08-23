'use client'

import { useState } from 'react'

export default function TestDBPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testWrite = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/test-db-write', { method: 'POST' })
      const data = await res.json()
      setResult(data)
      console.log('Test result:', data)
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Database Write Test</h1>

      <button
        onClick={testWrite}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Database Write'}
      </button>

      {result && (
        <div className="mt-6 p-4 bg-gray-100 rounded font-mono text-sm">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      {result?.success === false && (
        <div className="mt-6 p-4 bg-red-100 text-red-700 rounded">
          <strong>ERROR:</strong> {result.error}
        </div>
      )}

      {result?.match === false && (
        <div className="mt-6 p-4 bg-yellow-100 text-yellow-700 rounded">
          <strong>WARNING:</strong> Data was written but not read back correctly!
          <br />
          Wrote: {result.wrote}
          <br />
          Read: {result.read}
        </div>
      )}

      {result?.match === true && (
        <div className="mt-6 p-4 bg-green-100 text-green-700 rounded">
          <strong>SUCCESS:</strong> Database reads and writes are working!
        </div>
      )}
    </div>
  )
}
