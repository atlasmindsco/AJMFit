'use client'

import { useState } from 'react'

export default function DiagnosticsPage() {
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const runDiagnostics = async () => {
    setLoading(true)
    setResults(null)

    try {
      const res = await fetch('/api/nutrition/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentWeight: 180,
          goalWeight: 170,
          height: 72,
          age: 25,
          sex: 'male',
          activityLevel: 'moderate',
          goal: 'maintain',
        }),
      })

      const data = await res.json()
      setResults({
        status: res.status,
        statusText: res.statusText,
        response: JSON.stringify(data, null, 2),
        success: res.ok,
      })
    } catch (err: any) {
      setResults({
        error: err.message,
        stack: err.stack,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Nutrition Goals Diagnostic</h1>

      <div className="bg-blue-50 p-4 rounded mb-6 border border-blue-200">
        <p className="text-sm mb-3">
          This will attempt to save test nutrition goals and show you the exact response from the API.
        </p>
        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Running...' : 'Run Diagnostic'}
        </button>
      </div>

      {results && (
        <div className="space-y-4">
          <div className="bg-gray-100 p-4 rounded border">
            <h2 className="font-bold mb-2">Status: {results.status} {results.statusText}</h2>
            {results.success ? (
              <div className="text-green-700 bg-green-50 p-2 rounded">✓ API returned success</div>
            ) : (
              <div className="text-red-700 bg-red-50 p-2 rounded">✗ API returned error or non-200 status</div>
            )}
          </div>

          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-xs overflow-auto max-h-96">
            <pre>{results.response || results.error || results.stack}</pre>
          </div>

          {results.error && (
            <div className="bg-red-50 p-4 rounded border border-red-200">
              <p className="font-bold text-red-900">Error:</p>
              <p className="text-red-700 text-sm font-mono">{results.error}</p>
            </div>
          )}

          <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
            <p className="text-sm text-yellow-900">
              <strong>What to look for:</strong>
              <ul className="mt-2 space-y-1 text-xs">
                <li>• Status should be 200 (success)</li>
                <li>• Response should show 'ok: true' and verified data</li>
                <li>• If you see an error about RLS or permissions, that's the problem</li>
                <li>• Share this entire response with support</li>
              </ul>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
