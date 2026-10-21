import { Section, StatusRow, Tile } from '../components/Common.jsx'
import { LightBoard, SparkBars, Sparkline } from '../components/Lights.jsx'
import { STATUS_ORDER, usd, when } from '../format.js'

const UNIT_TITLE = { RBC: 'Red cell refrigerator', PLASMA: 'Plasma freezer', PLATELETS: 'Platelet incubator' }

export default function Overview({ report, go }) {
  const o = report.overview
  const items = [
    ...report.units.map((u) => ({
      id: u.unit_id,
      title: UNIT_TITLE[u.unit_type],
      kind: u.unit_type === 'RBC' ? 'red cells' : u.unit_type.toLowerCase(),
      status: u.status,
      reason: u.reason,
      page: 'temperature',
      visual: <Sparkline values={u.series.temp_c.slice(-42)} lower={u.spec.lower} upper={u.spec.upper} status={u.status} />,
    })),
    ...report.generators.map((g) => ({
      id: g.generator_id,
      title: 'Backup generator',
      kind: 'generator',
      status: g.status,
      reason: g.reason,
      page: 'generators',
      visual: <SparkBars values={g.p_chart.p} signals={g.p_chart.signal} status={g.status} />,
    })),
  ].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.id.localeCompare(b.id))

  return (
    <>
      <div className="tiles">
        <Tile label="Storage units monitored" num={o.units_monitored} note="Refrigerators, freezers, incubators" />
        <Tile label="Active alerts" num={o.active_alerts} note="Need staff review" tone={o.active_alerts ? 'warn' : 'ok'} />
        <Tile
          label="Units with excursions"
          num={o.units_with_excursions}
          note={`Outside storage spec since ${when(o.window_start)}`}
          tone={o.units_with_excursions ? 'bad' : 'ok'}
        />
        <Tile
          label="Generator start failures"
          num={o.generator_test_failures}
          note="Failed start demands, last 90 days"
          tone={o.generator_test_failures ? 'bad' : 'ok'}
        />
        <Tile
          label={`Blood at risk in a ${o.outage_hours} h blackout`}
          num={o.dollars_at_risk}
          fmt={usd}
          note={`Expected loss of ${usd(o.inventory_value)} inventory`}
          tone={o.dollars_at_risk > 10000 ? 'bad' : o.dollars_at_risk > 5000 ? 'warn' : 'ok'}
        />
      </div>

      <Section title="Equipment light board" kicker="Every unit at a glance · click a light">
        <LightBoard items={items} onPick={(it) => go(it.page, it.id)} />
      </Section>

      <div className="grid-2">
        <Section title="Equipment status" kicker="Measure → Analyze · last 7 days">
          <div className="status-list">
            {items.map((it, i) => (
              <StatusRow key={it.id} {...it} i={i} onClick={() => go(it.page, it.id)} />
            ))}
          </div>
        </Section>

        <Section title="What to do first" kicker="Improve">
          {report.actions.length === 0 ? (
            <p className="empty">✓ No action needed. Every unit is stable and in spec, and backup power is reliable. Keep logging (Control).</p>
          ) : (
            <ol className="actions">
              {report.actions.map((a, i) => (
                <li key={a.item} className={a.priority.toLowerCase()} style={{ '--i': i }}>
                  <b>{a.action}</b>
                  <small>Why: {a.why}</small>
                </li>
              ))}
            </ol>
          )}
          <div className="dmaic">
            {[
              ['D', 'Define', 'Blood must stay in its storage range; backup power must start'],
              ['M', 'Measure', 'Staff log temperatures every 4 h and every generator test'],
              ['A', 'Analyze', 'I-MR charts, run rules, Cpk, p chart, R(t)'],
              ['I', 'Improve', 'Ranked actions above'],
              ['C', 'Control', 'Fixed baseline limits; re-check every shift'],
            ].map(([k, t, d]) => (
              <div key={k} className="dmaic-step">
                <span>{k}</span>
                <b>{t}</b>
                <small>{d}</small>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}
