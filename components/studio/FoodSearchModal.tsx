'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { FoodNutrition, FoodUnit, recognizedFoodToFoodNutrition } from '@/lib/nutrition-calc'
import ServingSelector from './ServingSelector'

const BarcodeScanner = dynamic(() => import('@/components/studio/BarcodeScanner'), { ssr: false })

interface FoodSearchModalProps {
  mealId: string
  recentFoods: FoodNutrition[]
  onAdd: (mealId: string, quantity: number, unit: FoodUnit, totalNutrition: any, foodName: string) => void
  onClose: () => void
}

type InputMode = 'main' | 'search' | 'barcode' | 'photo' | 'recent'

export default function FoodSearchModal({
  mealId,
  recentFoods,
  onAdd,
  onClose,
}: FoodSearchModalProps) {
  const [mode, setMode] = useState<InputMode>('main')
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [selectedFood, setSelectedFood] = useState<FoodNutrition | null>(null)
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)

    try {
      const res = await fetch('/api/lookup-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim() }),
      })

      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      const foodNutrition = recognizedFoodToFoodNutrition(data)
      setSelectedFood(foodNutrition)
    } catch (err) {
      console.error('Search error:', err)
      alert('Could not find that food. Try another search.')
    } finally {
      setSearching(false)
    }
  }

  const handleBarcodeDetected = async (barcode: string) => {
    setMode('main')
    try {
      const res = await fetch('/api/lookup-barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode }),
      })

      if (res.status === 404) {
        alert('Barcode not found. Try searching instead.')
        return
      }

      if (!res.ok) throw new Error('Barcode lookup failed')
      const data = await res.json()
      const foodNutrition = recognizedFoodToFoodNutrition(data, barcode, data.brand)
      setSelectedFood(foodNutrition)
    } catch (err) {
      console.error('Barcode error:', err)
      alert('Could not scan that barcode. Try searching instead.')
    }
  }

  const handlePhotoAnalyze = async (file: File) => {
    setPhotoAnalyzing(true)

    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/analyze-food', { method: 'POST', body: formData })

      if (!res.ok) throw new Error('Photo analysis failed')
      const data = await res.json()
      const foodNutrition = recognizedFoodToFoodNutrition(data)
      setSelectedFood(foodNutrition)
    } catch (err) {
      console.error('Photo error:', err)
      alert('Could not analyze that photo. Try searching instead.')
    } finally {
      setPhotoAnalyzing(false)
    }
  }

  const handleAddFood = (
    food: FoodNutrition,
    quantity: number,
    unit: FoodUnit,
    totalNutrition: any
  ) => {
    onAdd(mealId, quantity, unit, totalNutrition, food.name)
    onClose()
  }

  // Serving selector is shown
  if (selectedFood) {
    return (
      <ServingSelector
        food={selectedFood}
        onAdd={handleAddFood}
        onCancel={() => setSelectedFood(null)}
      />
    )
  }

  // Barcode scanner is shown
  if (mode === 'barcode') {
    return (
      <BarcodeScanner
        onDetect={handleBarcodeDetected}
        onClose={() => setMode('main')}
      />
    )
  }

  // Main menu or search
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center"
    >
      <motion.div
        className="bg-white w-full md:w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-xl text-gray-800">
              {mode === 'main' ? 'Add Food' : 'Search Food'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {mode === 'main' ? (
            <>
              {/* Search */}
              <button
                onClick={() => setMode('search')}
                className="w-full flex items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-lg border border-blue-200 transition-colors"
              >
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Search</p>
                  <p className="text-sm text-gray-600">Find by name or brand</p>
                </div>
              </button>

              {/* Barcode */}
              <button
                onClick={() => setMode('barcode')}
                className="w-full flex items-center gap-3 p-4 bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 rounded-lg border border-orange-200 transition-colors"
              >
                <svg
                  className="w-5 h-5 text-orange-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Barcode</p>
                  <p className="text-sm text-gray-600">Scan product barcode</p>
                </div>
              </button>

              {/* Photo */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-3 p-4 bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-lg border border-green-200 transition-colors"
              >
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Photo</p>
                  <p className="text-sm text-gray-600">Take or upload photo</p>
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handlePhotoAnalyze(file)
                  }
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
              />

              {/* Recent Foods */}
              {recentFoods.length > 0 && (
                <>
                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="font-semibold text-gray-800 mb-3">Recent</h3>
                    <div className="space-y-2">
                      {recentFoods.slice(0, 5).map((food) => (
                        <button
                          key={food.id || food.name}
                          onClick={() => setSelectedFood(food)}
                          className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors"
                        >
                          <p className="font-semibold text-gray-800">{food.name}</p>
                          {food.brand && (
                            <p className="text-sm text-gray-500">{food.brand}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {food.baseNutrition.calories} cal
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            /* Search Input Mode */
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="e.g., chicken breast, milk, rice"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  autoFocus
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-colors"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
              <button
                onClick={() => setMode('main')}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg transition-colors"
              >
                Back
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
