'use client'

import { useState } from 'react'

interface RatingInputProps {
  value: number
  onChange: (value: number) => void
  label: string
}

export default function RatingInput({ value, onChange, label }: RatingInputProps) {
  const [hover, setHover] = useState(0)

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600 w-32">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`text-2xl transition-colors ${
              star <= (hover || value) ? 'text-yellow-500' : 'text-gray-300'
            }`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  )
}
