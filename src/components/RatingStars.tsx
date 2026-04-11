'use client'

interface RatingStarsProps {
  rating: number | null
  max?: number
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
}

export default function RatingStars({ rating, max = 5, size = 'md' }: RatingStarsProps) {
  if (rating === null) {
    return <span className={`text-gray-300 ${sizeClasses[size]}`}>{'☆'.repeat(max)}</span>
  }

  const fullStars = Math.floor(rating)
  const hasHalf = rating - fullStars >= 0.5
  const emptyStars = max - fullStars - (hasHalf ? 1 : 0)

  return (
    <span className={sizeClasses[size]} aria-label={`${rating} de ${max} estrellas`}>
      <span className="text-yellow-500">
        {'★'.repeat(fullStars)}
        {hasHalf && '★'}
      </span>
      <span className="text-gray-300">
        {'☆'.repeat(Math.max(0, emptyStars))}
      </span>
    </span>
  )
}
