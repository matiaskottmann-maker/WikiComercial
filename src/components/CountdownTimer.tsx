'use client'

import { useState, useEffect } from 'react'
import { getRemainingMs, formatCountdown } from '@/lib/utils'

interface CountdownTimerProps {
  createdAt: string
  onExpire?: () => void
}

export default function CountdownTimer({ createdAt, onExpire }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => getRemainingMs(createdAt))

  useEffect(() => {
    if (remaining <= 0) {
      onExpire?.()
      return
    }

    const interval = setInterval(() => {
      const ms = getRemainingMs(createdAt)
      setRemaining(ms)
      if (ms <= 0) {
        clearInterval(interval)
        onExpire?.()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [createdAt, onExpire, remaining])

  if (remaining <= 0) return null

  const isLow = remaining < 2 * 60 * 1000

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
        isLow
          ? 'text-red-400'
          : 'text-gray-400'
      }`}
      title="Tiempo restante para editar este aporte"
    >
      Editable por {formatCountdown(remaining)}
    </span>
  )
}
