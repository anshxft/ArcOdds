// Counts from 0 up to `to` the first time it scrolls into view.
// Same props as the React Bits CountUp it replaces, but built on NumberFlow (already used
// for odds) so the app no longer ships the motion library just for this.
import { useEffect, useRef, useState } from 'react'
import NumberFlow from '@number-flow/react'

interface CountUpProps {
  to: number
  duration?: number // seconds
  separator?: string
  className?: string
}

export default function CountUp({ to, duration = 1, separator = '', className = '' }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState(0)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setSeen(true))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (seen) setValue(to)
  }, [seen, to])

  const decimals = Math.min(2, (String(to).split('.')[1] ?? '').length)
  return (
    <span ref={ref} className={className}>
      <NumberFlow
        value={value}
        format={{ useGrouping: Boolean(separator), minimumFractionDigits: decimals, maximumFractionDigits: decimals }}
        transformTiming={{ duration: duration * 1000, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
        spinTiming={{ duration: duration * 1000, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
      />
    </span>
  )
}
