// Dataset-change transition: the old dashboard breaks into rigid bodies that collide and tumble off
// screen (matter-js), and the new dashboard's cards drop in from above on damped springs.
// Purely visual. No statistics here.
import Matter from 'matter-js'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const rand = (a, b) => a + Math.random() * (b - a)

/** Top-level animatable blocks inside a container (a tile or card that is not inside another one). */
export function pieces(container) {
  if (!container) return []
  const all = [...container.querySelectorAll('[data-fx]')]
  return all.filter((el) => !el.parentElement.closest('[data-fx]') || !container.contains(el.parentElement.closest('[data-fx]')))
}

/**
 * Clone every visible block into a fixed overlay and let gravity take it. Returns a promise that
 * resolves when the pieces have left the screen (or after maxMs).
 */
export function shatterOut(container, { maxMs = 2200 } = {}) {
  const els = pieces(container)
  const vh = window.innerHeight
  const vw = window.innerWidth
  const overlay = document.createElement('div')
  overlay.className = 'fx-overlay'
  document.body.appendChild(overlay)

  const { Engine, Bodies, Body, Composite } = Matter
  const engine = Engine.create({ gravity: { x: 0, y: 2.8 } })
  const items = []

  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.bottom < -40 || r.top > vh + 40 || r.width < 4) continue
    const clone = el.cloneNode(true)
    Object.assign(clone.style, {
      position: 'fixed',
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      margin: '0',
      transformOrigin: 'center center',
      willChange: 'transform, opacity',
    })
    clone.classList.add('fx-falling')
    overlay.appendChild(clone)
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const body = Bodies.rectangle(cx, cy, r.width, r.height, {
      chamfer: { radius: 14 },
      restitution: 0.35,
      friction: 0.2,
      frictionAir: 0.012,
      density: 0.0012,
    })
    // A small upward "pop", sideways scatter away from the centre, and a spin.
    const away = (cx - vw / 2) / vw
    Body.setVelocity(body, { x: away * rand(8, 16) + rand(-3, 3), y: rand(-11, -4) })
    Body.setAngularVelocity(body, rand(-0.045, 0.045))
    items.push({ clone, body, cx, cy })
  }
  // Side walls keep the pieces on screen so they collide with each other on the way down.
  const walls = [
    Bodies.rectangle(-60, vh / 2, 120, vh * 4, { isStatic: true }),
    Bodies.rectangle(vw + 60, vh / 2, 120, vh * 4, { isStatic: true }),
  ]
  Composite.add(engine.world, [...items.map((i) => i.body), ...walls])

  return new Promise((resolve) => {
    const t0 = performance.now()
    let last = t0
    function step(now) {
      const dt = Math.min(32, now - last)
      last = now
      Engine.update(engine, dt)
      let onScreen = 0
      for (const { clone, body, cx, cy } of items) {
        const { x, y } = body.position
        clone.style.transform = `translate(${x - cx}px, ${y - cy}px) rotate(${body.angle}rad)`
        if (y - 200 < vh) onScreen++
      }
      const t = now - t0
      if (t > maxMs * 0.7) overlay.style.opacity = String(Math.max(0, 1 - (t - maxMs * 0.7) / (maxMs * 0.3)))
      if (onScreen === 0 || t > maxMs) {
        Engine.clear(engine)
        overlay.remove()
        resolve()
      } else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

/**
 * Drop every block of the (already rendered) container in from above. Each block falls on an
 * under-damped spring, so it overshoots and settles with a small bounce, staggered top-to-bottom.
 */
export function dropIn(container, { stagger = 55 } = {}) {
  const els = pieces(container)
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.top < window.innerHeight + 200)
    .sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left)

  const k = 170 // spring stiffness
  const c = 15 // damping (critical would be ~26: this bounces)
  const states = els.map(({ el, r }, i) => {
    const y = -(r.bottom + rand(60, 260))
    const a = rand(-14, 14)
    el.style.transform = `translateY(${y}px) rotate(${a}deg)`
    el.style.willChange = 'transform'
    el.classList.add('fx-moving')
    return { el, y, v: 0, a, va: 0, delay: i * stagger, landed: false, done: false }
  })

  return new Promise((resolve) => {
    const t0 = performance.now()
    let last = t0
    function step(now) {
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      let active = 0
      for (const s of states) {
        if (s.done) continue
        active++
        if (now - t0 < s.delay) continue
        // y'' = -k y - c y'   (same for the tilt angle, a bit softer)
        s.v += (-k * s.y - c * s.v) * dt
        s.y += s.v * dt
        s.va += (-k * 0.8 * s.a - c * s.va) * dt
        s.a += s.va * dt
        if (!s.landed && s.y > -2) {
          s.landed = true
          s.el.classList.remove('fx-landed')
          void s.el.offsetWidth // restart the landing glow animation
          s.el.classList.add('fx-landed')
        }
        if (Math.abs(s.y) < 0.4 && Math.abs(s.v) < 4 && Math.abs(s.a) < 0.05) {
          s.done = true
          s.el.style.transform = ''
          s.el.style.willChange = ''
          s.el.classList.remove('fx-moving')
        } else {
          s.el.style.transform = `translateY(${s.y}px) rotate(${s.a}deg)`
        }
      }
      if (active === 0 || now - t0 > 4000) {
        states.forEach((s) => {
          s.el.style.transform = ''
          s.el.style.willChange = ''
          s.el.classList.remove('fx-moving')
        })
        resolve()
      } else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}
