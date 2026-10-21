// Flowing animated background: drifting aurora glows plus particles that follow a slow flow field,
// tinted with the current dataset's accent colour. Decorative only.
import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../physics.js'

const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

export default function Background({ accent = '#4cc9f0', accent2 = '#e5383b' }) {
  const ref = useRef(null)
  const colors = useRef({ a: hexToRgb(accent), b: hexToRgb(accent2) })
  colors.current = { a: hexToRgb(accent), b: hexToRgb(accent2) }

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let w, h, raf
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const N = 90
    let parts = []
    const resize = () => {
      w = canvas.width = window.innerWidth * dpr
      h = canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      parts = Array.from({ length: N }, () => ({ x: Math.random() * w, y: Math.random() * h, s: Math.random() * 1.6 + 0.4, l: Math.random() }))
    }
    resize()
    window.addEventListener('resize', resize)
    const still = prefersReducedMotion()
    const mix = (t) => colors.current.a.map((v, i) => Math.round(v + (colors.current.b[i] - v) * t))

    function frame(ms) {
      const t = ms / 1000
      ctx.clearRect(0, 0, w, h)
      // Aurora glows: three large radial gradients drifting on slow sine paths.
      const blobs = [
        [0.18 + 0.08 * Math.sin(t * 0.13), 0.12 + 0.06 * Math.cos(t * 0.11), 0.55, 0],
        [0.85 + 0.06 * Math.cos(t * 0.09), 0.2 + 0.08 * Math.sin(t * 0.12), 0.45, 1],
        [0.55 + 0.12 * Math.sin(t * 0.07), 0.95 + 0.05 * Math.cos(t * 0.1), 0.6, 0.5],
      ]
      for (const [bx, by, br, mixT] of blobs) {
        const [r, g, b] = mix(mixT)
        const grad = ctx.createRadialGradient(bx * w, by * h, 0, bx * w, by * h, br * Math.max(w, h))
        grad.addColorStop(0, `rgba(${r},${g},${b},0.16)`)
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, h)
      }
      // Particles riding a flow field (cold mist rising).
      for (const p of parts) {
        const ang = Math.sin(p.x * 0.0016 + t * 0.2) + Math.cos(p.y * 0.0021 - t * 0.15)
        if (!still) {
          p.x += Math.cos(ang) * 0.35 * dpr * p.s
          p.y += (Math.sin(ang) * 0.25 - 0.35) * dpr * p.s
        }
        if (p.y < -10) p.y = h + 10
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        const [r, g, b] = mix(p.l)
        ctx.fillStyle = `rgba(${r},${g},${b},${0.25 + 0.25 * Math.sin(t + p.l * 6)})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.s * dpr, 0, Math.PI * 2)
        ctx.fill()
      }
      if (!still) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className="bg-canvas" aria-hidden="true" />
}
