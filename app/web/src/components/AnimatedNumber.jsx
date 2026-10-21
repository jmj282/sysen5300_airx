// Counts smoothly from the previous value to the new one. Display only.
import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../physics.js'

export default function AnimatedNumber({ value, format = (v) => Math.round(v).toLocaleString(), duration = 1100 }) {
  const [shown, setShown] = useState(prefersReducedMotion() ? value : 0)
  const from = useRef(0)
  useEffect(() => {
    if (value === null || value === undefined || Number.isNaN(value)) return
    if (prefersReducedMotion()) {
      setShown(value)
      return
    }
    const start = performance.now()
    const a = from.current
    let raf
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration)
      const e = 1 - Math.pow(1 - p, 3) // ease-out cubic
      setShown(a + (value - a) * e)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      from.current = value
    }
  }, [value, duration])
  if (value === null || value === undefined) return '—'
  return format(shown)
}
