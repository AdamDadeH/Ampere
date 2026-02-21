import { useState } from 'react'

interface StarRatingProps {
  rating: number
  onChange?: (rating: number) => void
  size?: 'sm' | 'md'
  inferred?: boolean
}

export function StarRating({ rating, onChange, size = 'sm', inferred }: StarRatingProps): React.JSX.Element {
  const [hovered, setHovered] = useState(0)
  const fontSize = size === 'md' ? '16px' : '12px'

  const handleClick = (star: number, e: React.MouseEvent): void => {
    e.stopPropagation()
    if (onChange) {
      onChange(star === rating ? 0 : star)
    }
  }

  return (
    <div
      className="inline-flex gap-px"
      onMouseLeave={() => setHovered(0)}
      title={inferred ? 'Predicted rating (click to override)' : undefined}
    >
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          className="cursor-pointer leading-none p-0 border-0 bg-transparent"
          style={{
            fontSize,
            opacity: inferred && !hovered ? 0.5 : 1,
            color: hovered
              ? star <= hovered ? 'var(--color-star-hover)' : 'var(--color-star-empty)'
              : star <= rating ? 'var(--color-star-filled)' : 'var(--color-star-empty)'
          }}
          onMouseEnter={() => setHovered(star)}
          onClick={(e) => handleClick(star, e)}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          &#9733;
        </button>
      ))}
    </div>
  )
}
