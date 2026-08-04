import { useCallback, useState, useEffect } from 'react'
import { FoodNutrition, FoodUnit } from './nutrition-calc'

interface FoodHistory {
  foodId: string
  lastQuantity: number
  lastUnit: FoodUnit
  lastUsed: number // timestamp
}

const STORAGE_KEY = 'nutrition_food_history'
const MAX_RECENT = 10

/**
 * Hook to manage food selection, recent foods, and serving preferences
 */
export function useNutritionFoods() {
  const [recentFoods, setRecentFoods] = useState<FoodHistory[]>([])
  const [loaded, setLoaded] = useState(false)

  // Load recent foods from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as FoodHistory[]
        setRecentFoods(parsed)
      }
    } catch (e) {
      console.error('Failed to load recent foods:', e)
    }
    setLoaded(true)
  }, [])

  // Save a food to recent history
  const saveToRecent = useCallback(
    (food: FoodNutrition, quantity: number, unit: FoodUnit) => {
      try {
        setRecentFoods((prev) => {
          // Remove if already exists
          const filtered = prev.filter((f) => f.foodId !== food.id)

          // Add to top
          const updated = [
            {
              foodId: food.id || food.name,
              lastQuantity: quantity,
              lastUnit: unit,
              lastUsed: Date.now(),
            },
            ...filtered,
          ].slice(0, MAX_RECENT)

          // Persist
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
          return updated
        })
      } catch (e) {
        console.error('Failed to save recent food:', e)
      }
    },
    []
  )

  // Get last used quantity and unit for a food
  const getLastServing = useCallback(
    (foodId: string): { quantity: number; unit: FoodUnit } | null => {
      const history = recentFoods.find((f) => f.foodId === foodId)
      return history
        ? { quantity: history.lastQuantity, unit: history.lastUnit }
        : null
    },
    [recentFoods]
  )

  // Get recent foods (for quick access)
  const getRecent = useCallback(
    (foods: FoodNutrition[]): FoodNutrition[] => {
      return recentFoods
        .map((h) => foods.find((f) => (f.id || f.name) === h.foodId))
        .filter((f) => f !== undefined) as FoodNutrition[]
    },
    [recentFoods]
  )

  return {
    loaded,
    recentFoods,
    saveToRecent,
    getLastServing,
    getRecent,
  }
}
