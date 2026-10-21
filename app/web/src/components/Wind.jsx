// "AirX": wind streams blowing behind the logo. Decorative SVG; CSS animates the dashes.
const STREAMS = [
  { d: 'M-40,18 C40,6 90,30 170,16 S300,4 380,20', w: 1.6, dur: 2.6, delay: 0, o: 0.55 },
  { d: 'M-40,34 C50,22 110,46 190,30 S320,20 400,36', w: 2.2, dur: 3.2, delay: 0.6, o: 0.7 },
  { d: 'M-40,50 C30,40 100,62 180,48 S310,36 390,52', w: 1.4, dur: 2.2, delay: 1.1, o: 0.5 },
  { d: 'M-40,62 C60,54 120,74 200,60 S330,50 410,66', w: 1.8, dur: 2.9, delay: 0.3, o: 0.6 },
  { d: 'M-40,8 C70,0 130,20 210,8 S340,-2 420,10', w: 1.2, dur: 3.6, delay: 1.6, o: 0.4 },
]

export default function Wind() {
  return (
    <svg className="wind" viewBox="0 0 400 72" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="windFade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="0.25" stopColor="var(--accent)" stopOpacity="1" />
          <stop offset="0.75" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {STREAMS.map((s, i) => (
        <path
          key={i}
          d={s.d}
          className="gust"
          stroke="url(#windFade)"
          strokeWidth={s.w}
          style={{ animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s`, opacity: s.o }}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <path key={`c${i}`} className="curl" d={`M${60 + i * 110},${20 + i * 14} q14,-16 26,0 q-10,12 -20,2`} style={{ animationDelay: `${i * 0.9}s` }} />
      ))}
    </svg>
  )
}
