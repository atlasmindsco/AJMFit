'use client'

import { useState } from 'react'

export default function NutritionSimplePage() {
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [age, setAge] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    alert('Button clicked!')

    if (!weight || !height || !age) {
      alert('Please fill in all fields')
      return
    }

    // Save to localStorage
    const data = {
      weight,
      height,
      age,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem('nutrition_data', JSON.stringify(data))
    alert('✓ Saved to your phone!')
    setSaved(true)

    // Read it back to verify
    const retrieved = localStorage.getItem('nutrition_data')
    alert('Retrieved: ' + retrieved)
  }

  const handleClear = () => {
    localStorage.removeItem('nutrition_data')
    setSaved(false)
    alert('Cleared')
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Simple Nutrition Test</h1>

      <div style={{ marginBottom: '20px' }}>
        <label>Weight (lbs): </label>
        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          style={{ padding: '10px', marginLeft: '10px' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label>Height (inches): </label>
        <input
          type="number"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          style={{ padding: '10px', marginLeft: '10px' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label>Age: </label>
        <input
          type="number"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          style={{ padding: '10px', marginLeft: '10px' }}
        />
      </div>

      <button
        onClick={handleSave}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: 'blue',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          marginRight: '10px',
        }}
      >
        Save
      </button>

      <button
        onClick={handleClear}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: 'gray',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Clear
      </button>

      {saved && (
        <div style={{ marginTop: '20px', color: 'green', fontSize: '18px' }}>
          ✓ Data saved to your phone!
        </div>
      )}
    </div>
  )
}
