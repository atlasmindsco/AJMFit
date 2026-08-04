'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  FoodNutrition,
  FoodUnit,
  calculateNutrition,
  convertToGrams,
  convertFromGrams,
  formatNutrition,
  getSuggestedUnits,
  QUICK_ADJUSTMENTS,
} from '@/lib/nutrition-calc'

interface ServingSelectorProps {
  food: FoodNutrition
  defaultQuantity?: number
  defaultUnit?: FoodUnit
  onAdd: (food: FoodNutrition, quantity: number, unit: FoodUnit, totalNutrition: any) => void
  onCancel: () => void
}

export default function ServingSelector({
  food,
  defaultQuantity = 1,
  defaultUnit,
  onAdd,
  onCancel,
}: ServingSelectorProps) {
  const [quantity, setQuantity] = useState(defaultQuantity)
  const [selectedUnit, setSelectedUnit] = useState<FoodUnit>(
    defaultUnit || food.availableUnits[0]
  )
  const [calculatedNutrition, setCalculatedNutrition] = useState(food.baseNutrition)

  // Recalculate nutrition whenever quantity or unit changes
  useEffect(() => {
    const servingGrams = convertToGrams(quantity, selectedUnit)
    const nutrition = calculateNutrition(food.baseNutrition, food.baseWeight, servingGrams)
    setCalculatedNutrition(nutrition)
  }, [quantity, selectedUnit, food])

  const handleAddFood = () => {
    onAdd(food, quantity, selectedUnit, calculatedNutrition)
  }

  const handleQuickAdjust = (factor: number) => {
    setQuantity((prev) => Math.max(0.25, Number((prev * factor).toFixed(2))))
  }

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0
    setQuantity(Math.max(0.25, value))
  }

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
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display font-bold text-xl text-gray-800">{food.name}</h2>
              {food.brand && <p className="text-gray-500 text-sm">{food.brand}</p>}
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Serving Selector */}
        <div className="p-6 space-y-6">
          {/* Quantity Input */}
          <div>
            <label className="block text-xs font-display font-bold text-gray-600 uppercase mb-3">
              Quantity
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleQuickAdjust(0.5)}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-semibold text-sm transition-colors"
              >
                −
              </button>
              <div className="flex-1">
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={quantity}
                  onChange={handleQuantityChange}
                  className="w-full px-4 py-3 text-center text-lg font-display font-bold border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => handleQuickAdjust(2)}
                className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-sm transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Unit Selection */}
          <div>
            <label className="block text-xs font-display font-bold text-gray-600 uppercase mb-3">
              Unit of Measurement
            </label>
            <div className="grid grid-cols-2 gap-2">
              {food.availableUnits.map((unit) => (
                <button
                  key={unit.abbreviation}
                  onClick={() => setSelectedUnit(unit)}
                  className={`py-3 px-4 rounded-lg font-semibold text-sm transition-all ${
                    selectedUnit.abbreviation === unit.abbreviation
                      ? 'bg-blue-500 text-white border-2 border-blue-500'
                      : 'bg-gray-100 text-gray-800 border-2 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {unit.abbreviation}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Adjustments */}
          <div>
            <label className="block text-xs font-display font-bold text-gray-600 uppercase mb-3">
              Quick Adjust
            </label>
            <div className="flex gap-2 flex-wrap">
              {QUICK_ADJUSTMENTS.map((adj) => (
                <button
                  key={adj}
                  onClick={() => setQuantity(adj)}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                    Math.abs(quantity - adj) < 0.01
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {adj}
                </button>
              ))}
            </div>
          </div>

          {/* Nutrition Display */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="font-display font-bold text-gray-800 text-sm">Nutrition Facts</h3>

            {/* Calories (Highlighted) */}
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="font-body font-semibold text-gray-700">Calories</span>
              <span className="font-display font-bold text-2xl text-blue-600">
                {formatNutrition(calculatedNutrition.calories, 0)}
              </span>
            </div>

            {/* Macros Grid */}
            <div className="grid grid-cols-3 gap-3">
              <NutrientCard
                label="Protein"
                value={calculatedNutrition.protein}
                unit="g"
                color="blue"
              />
              <NutrientCard
                label="Carbs"
                value={calculatedNutrition.carbs}
                unit="g"
                color="orange"
              />
              <NutrientCard label="Fat" value={calculatedNutrition.fats} unit="g" color="yellow" />
            </div>

            {/* Micros (if available) */}
            {(calculatedNutrition.fiber ||
              calculatedNutrition.sugar ||
              calculatedNutrition.sodium) && (
              <div className="space-y-2 pt-2 border-t border-gray-200">
                {calculatedNutrition.fiber && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Fiber</span>
                    <span className="font-semibold text-gray-800">
                      {formatNutrition(calculatedNutrition.fiber)}g
                    </span>
                  </div>
                )}
                {calculatedNutrition.sugar && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Sugar</span>
                    <span className="font-semibold text-gray-800">
                      {formatNutrition(calculatedNutrition.sugar)}g
                    </span>
                  </div>
                )}
                {calculatedNutrition.sodium && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Sodium</span>
                    <span className="font-semibold text-gray-800">
                      {formatNutrition(calculatedNutrition.sodium)}mg
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Serving Info */}
          <p className="text-xs text-gray-500 text-center">
            {quantity} {selectedUnit.abbreviation} ({formatNutrition(convertToGrams(quantity, selectedUnit), 0)}g)
          </p>
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 space-y-3">
          <button
            onClick={handleAddFood}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-display font-bold rounded-lg transition-colors"
          >
            Add to Diary
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-display font-bold rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

interface NutrientCardProps {
  label: string
  value: number | undefined
  unit: string
  color: 'blue' | 'orange' | 'yellow'
}

function NutrientCard({ label, value, unit, color }: NutrientCardProps) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  }

  return (
    <div className={`p-3 rounded-lg border ${colorMap[color]} text-center`}>
      <p className="text-xs font-body text-gray-600 mb-1">{label}</p>
      <p className="font-display font-bold text-lg">
        {formatNutrition(value)}
        <span className="text-xs ml-0.5">{unit}</span>
      </p>
    </div>
  )
}
