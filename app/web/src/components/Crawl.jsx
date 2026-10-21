// An original opening crawl for AirX ColdChain QC, styled like the classic space-opera crawl:
// yellow justified text receding into a starfield. (Original text, not the film's.)
import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../physics.js'

const INTRO = 'A short time ago, in a blood bank not so far away....'

const CRAWL = {
  episode: 'Episode 5300',
  title: 'A NEW BASELINE',
  paragraphs: [
    'It is a period of unrest in the cold chain. Rebel compressors, striking from deep inside aging refrigerators, have begun to drift above six degrees, imperiling the precious supply of the regional blood bank.',
    'During the last blackout, the technicians discovered that backup generator G-02 would not start, leaving thousands of dollars of red cells, plasma and platelets defenseless against the creeping warmth.',
    'Pursued by the sinister forces of special-cause variation, Team AirX races to deploy COLDCHAIN QC, an armored array of control charts, run rules and reliability functions that can flag failure before it strikes and restore stability to the galaxy....',
  ],
}

export default function Crawl() {
  const ref = useRef(null)
  const [phase, setPhase] = useState('waiting') // waiting -> intro -> crawl
  const [run, setRun] = useState(0)
  useEffect(() => {
    if (prefersReducedMotion()) {
      setPhase('static')
      return
    }
    const el = ref.current
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setPhase((p) => (p === 'waiting' ? 'intro' : p))
        }
      },
      { threshold: 0.35 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (phase !== 'intro') return
    const t = setTimeout(() => setPhase('crawl'), 5200)
    return () => clearTimeout(t)
  }, [phase])

  return (
    <section ref={ref} className={`crawl-stage ${phase}`} aria-label="Opening crawl">
      <div className="stars" />
      <div className="stars far" />
      <p className="crawl-intro">{INTRO}</p>
      <div className="crawl-logo" key={`logo${run}`}>
        <span>AirX</span>
        <span>ColdChain</span>
      </div>
      <div className="crawl-fade" />
      <div className="crawl-perspective" key={`text${run}`}>
        <div className="crawl-text">
          <p className="crawl-episode">{CRAWL.episode}</p>
          <h2 className="crawl-title">{CRAWL.title}</h2>
          {CRAWL.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
      <button
        className="crawl-replay"
        onClick={() => {
          setRun((r) => r + 1)
          setPhase(prefersReducedMotion() ? 'static' : 'intro')
        }}
      >
        ↻ replay
      </button>
    </section>
  )
}
