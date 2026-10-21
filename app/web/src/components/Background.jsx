// Animated background (decorative only):
//  - a rotating disco ball whose mirror tiles throw coloured light spots that sweep across the page,
//  - aurora glows whose colours follow the ball's rotation (the "light in the back"),
//  - particles riding a slow flow field, tinted with the current dataset's accent colour.
import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../physics.js'

const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

function hsl(h, s, l) {
  // returns [r, g, b] 0-255
  s /= 100
  l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [255 * f(0), 255 * f(8), 255 * f(4)].map(Math.round)
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
    let parts = []
    // Mirror "spots": each is a fixed direction on the ball; as the ball spins they sweep the room.
    const spots = Array.from({ length: 34 }, (_, i) => ({ lon: (i / 34) * Math.PI * 2 + Math.random() * 0.4, lat: Math.random() * 0.9 + 0.05, size: Math.random() * 0.6 + 0.5, hue: Math.random() * 360 }))
    const resize = () => {
      w = canvas.width = window.innerWidth * dpr
      h = canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      parts = Array.from({ length: 90 }, () => ({ x: Math.random() * w, y: Math.random() * h, s: Math.random() * 1.6 + 0.4, l: Math.random() }))
    }
    resize()
    window.addEventListener('resize', resize)
    const still = prefersReducedMotion()
    const mix = (t) => colors.current.a.map((v, i) => Math.round(v + (colors.current.b[i] - v) * t))

    function drawBall(cx, cy, r, rot, t) {
      // String
      ctx.strokeStyle = 'rgba(200,205,220,0.35)'
      ctx.lineWidth = 1.2 * dpr
      ctx.beginPath()
      ctx.moveTo(cx, 0)
      ctx.lineTo(cx, cy - r)
      ctx.stroke()
      // Glow halo, hue follows rotation
      const halo = hsl((rot * 57) % 360, 90, 60)
      const g = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 3.2)
      g.addColorStop(0, `rgba(${halo},0.28)`)
      g.addColorStop(1, `rgba(${halo},0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, r * 3.2, 0, Math.PI * 2)
      ctx.fill()
      // Mirror tiles: latitude bands x longitude slices; only front-facing tiles are drawn.
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.clip()
      ctx.fillStyle = '#1b1f2b'
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
      const bands = 12
      const slices = 24
      for (let b = 0; b < bands; b++) {
        const la0 = -Math.PI / 2 + (b / bands) * Math.PI
        const la1 = -Math.PI / 2 + ((b + 1) / bands) * Math.PI
        for (let s = 0; s < slices; s++) {
          const lo0 = (s / slices) * Math.PI * 2 + rot
          const lo1 = ((s + 1) / slices) * Math.PI * 2 + rot
          const loM = (lo0 + lo1) / 2
          const laM = (la0 + la1) / 2
          const zf = Math.cos(laM) * Math.cos(loM) // facing the viewer
          if (zf <= 0) continue
          const pt = (la, lo) => [cx + r * Math.cos(la) * Math.sin(lo), cy + r * Math.sin(la)]
          const p = [pt(la0, lo0), pt(la0, lo1), pt(la1, lo1), pt(la1, lo0)]
          // Light from the upper left, plus a flicker so tiles sparkle as they turn.
          const nx = Math.cos(laM) * Math.sin(loM)
          const ny = Math.sin(laM)
          const lit = Math.max(0, -0.55 * nx - 0.6 * ny + 0.58 * zf)
          const sparkle = Math.pow(Math.max(0, Math.sin(loM * 7 + laM * 5 + t * 3)), 18)
          const hue = (loM * 57 + b * 25 + t * 40) % 360
          const [cr, cg, cb] = hsl(hue, 35 + 50 * sparkle, 25 + 45 * lit + 30 * sparkle)
          ctx.fillStyle = `rgb(${cr},${cg},${cb})`
          ctx.beginPath()
          ctx.moveTo(...p[0])
          p.slice(1).forEach((q) => ctx.lineTo(...q))
          ctx.closePath()
          ctx.fill()
          ctx.strokeStyle = 'rgba(8,9,13,0.85)'
          ctx.lineWidth = 0.8 * dpr
          ctx.stroke()
        }
      }
      // Specular highlight
      const sp = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx - r * 0.35, cy - r * 0.4, r * 0.7)
      sp.addColorStop(0, 'rgba(255,255,255,0.45)')
      sp.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = sp
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
      ctx.restore()
    }

    function frame(ms) {
      const t = ms / 1000
      const rot = t * 0.45 // radians per second the ball turns
      ctx.clearRect(0, 0, w, h)
      // Aurora glows; one of them takes the disco ball's current colour, so the back light changes as it spins.
      const disco = hsl((rot * 57) % 360, 85, 55)
      const blobs = [
        [0.18 + 0.08 * Math.sin(t * 0.13), 0.12 + 0.06 * Math.cos(t * 0.11), 0.55, mix(0), 0.15],
        [0.85 + 0.06 * Math.cos(t * 0.09), 0.2 + 0.08 * Math.sin(t * 0.12), 0.45, mix(1), 0.14],
        [0.55 + 0.12 * Math.sin(t * 0.07), 0.95 + 0.05 * Math.cos(t * 0.1), 0.6, mix(0.5), 0.13],
        [0.62 + 0.1 * Math.sin(t * 0.2), 0.45 + 0.1 * Math.cos(t * 0.17), 0.5, disco, 0.12],
      ]
      for (const [bx, by, br, [r, g, b], a] of blobs) {
        const grad = ctx.createRadialGradient(bx * w, by * h, 0, bx * w, by * h, br * Math.max(w, h))
        grad.addColorStop(0, `rgba(${r},${g},${b},${a})`)
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, w, h)
      }
      // Light spots thrown by the ball, sweeping across the page as it rotates.
      const bx = w * 0.6
      const by = 88 * dpr
      const br = 46 * dpr
      ctx.globalCompositeOperation = 'lighter'
      for (const s of spots) {
        const a = s.lon + rot
        const facing = Math.cos(a)
        if (facing < -0.2) continue
        const x = bx + Math.sin(a) * w * 0.75
        const y = by + s.lat * h * 1.05
        const rad = (18 + 30 * s.size) * dpr * (0.6 + 0.4 * facing)
        const [r, g, b] = hsl((s.hue + rot * 57) % 360, 95, 62)
        const gr = ctx.createRadialGradient(x, y, 0, x, y, rad)
        const alpha = 0.22 * Math.max(0, facing + 0.2)
        gr.addColorStop(0, `rgba(${r},${g},${b},${alpha})`)
        gr.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.fillStyle = gr
        ctx.beginPath()
        ctx.arc(x, y, rad, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
      // Particles (cold mist rising)
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
      drawBall(bx, by, br, rot, t)
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
