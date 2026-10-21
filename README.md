# 🩸 AirX ColdChain QC

**Six Sigma monitoring for blood bank refrigeration and backup power.**
Team **AirX** · Cornell SYSEN 5300 Six Sigma Hackathon · Virtual DL Challenge · Prompt: *Health Care Systems: Blood Banks*

> *"A regional blood bank loses thousands of dollars of supply when older refrigeration units fail or
> backup generators don't start during blackouts. Design a tool to track blood bank supply integrity and
> flag/predict failures."*

AirX ColdChain QC turns the paper logs a blood bank already keeps (a fridge temperature every 4 hours, a
signature in the generator logbook) into a shift-change answer: **which unit needs service or an
inventory move before the blood is compromised, and will backup power last through the next blackout?**
Every number comes from a tested Python library built on the SYSEN 5300 course methods.

![Overview of the temperature-degradation scenario](docs/images/demo/2-degradation-overview.jpg)

| | |
|---|---|
| **User** | The blood bank's storage and quality technician: the person who logs temperatures each shift and signs off on generator tests |
| **Decision** | At each shift change: service a unit or move its inventory *before* an excursion; repair a generator *before* the next storm |
| **Inputs** | Three CSV logs they already keep on paper (no sensors, no account): [codebook](data/README.md) |
| **Outputs** | Normal / Warning / Critical status with the Six Sigma reason, I-MR charts, capability indices with CIs, p chart, R(t), P(loss of cooling), dollars at risk, ranked actions |
| **Stack** | Python statistics library (`bloodbank_qc`) → FastAPI REST API → React (Vite) dashboard |

---

## Quick start (one command each)

```bash
git clone https://github.com/jmj282/sysen5300_airx.git && cd sysen5300_airx
app/api/testme.sh      # creates .venv, runs the 57 tests, starts the API on http://localhost:8000
app/web/testme.sh      # in a second terminal (Node 20+): the dashboard on http://localhost:5173
```

Then pick a scenario in the **Data** menu. No front end? Open **http://localhost:8000/docs**: every
endpoint is runnable there. **Live URL:** *pending deployment (see [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md), Q1).*

## The Six Sigma behind it (DMAIC)

| Phase | In this tool |
|---|---|
| **Define** | CTQ: blood stays inside its storage range (red cells 1–6 °C, plasma ≤ −18 °C, platelets 20–24 °C), and backup power starts when the grid fails. Cost of poor quality = discarded units. |
| **Measure** | Staff log temperatures every 4 h and every generator test or outage: the proxy variables Devpost asks for. |
| **Analyze** | Fridges: **I-MR control chart** from a 14-day baseline + the **8 run rules** (is it *stable*?) and **Cp/Cpk/Pp/Ppk** with 95% CIs (is it *capable*?). Generators: **p chart** of failed starts, **exponential reliability** (λ̂, R(t), MTTF, k-factor bounds), and a **series/parallel block diagram** for P(loss of cooling). |
| **Improve** | Ranked actions: move inventory, call refrigeration service, repair a generator, with the dollars involved. |
| **Control** | Limits stay fixed at the baseline; status re-checked every shift; re-baseline after repair. |

Method details, formulas, course citations and known-answer checks:
**[docs/SIX_SIGMA_METHODS.md](docs/SIX_SIGMA_METHODS.md)**. In the app: the **Methods** tab.

### Three decisions worth knowing

1. **Stable ≠ capable.** Control limits (blue band) come from the unit's own baseline; spec limits
   (dashed red) come from regulation. R-04 in the degradation scenario has a baseline Cpk of 2.73 (very
   capable) and still fails, which is why the chart comes first.
2. **Confirmed signals.** All 8 run rules on every reading would false-alarm on ~48% of healthy fridges
   a week. A status changes only when ≥3 readings in 24 h signal: ~1% false alarms, 97% of real shifts
   caught, and a failing compressor flagged ~4.5 days before it leaves spec (simulated; see methods §2b).
3. **Rare failures need exact limits.** Generators fail to start <1% of the time, so the p chart uses
   quarterly subgroups and exact binomial probability limits (same 0.135% tail as 3σ) instead of the
   normal approximation, which would flag a single failure.

## Demonstration

A guided tour of all three test datasets with every number explained: **[demo/README.md](demo/README.md)**.

| Scenario | Planted problem | What the tool shows |
|---|---|---|
| `normal_operation` | none | 0 alerts, every Cpk 1.50–2.89 |
| `temperature_degradation` | R-04 compressor drift; R-07 set-point shift | R-04 **Critical**, flagged **124 h before** its first excursion; R-07 **Warning** while still in spec |
| `generator_failure` | G-02 failing start tests and the Oct 6 blackout | G-02 **Critical**, P(loss of cooling in 8 h) **18.7%**, **$26,179** expected loss |

## Repository map

```
app/api/                 Python: statistics library + REST API
  bloodbank_qc/          the statistics (plain functions, no web framework)
    spc.py               I-MR limits, 8 run rules, p chart
    capability.py        Cp, Cpk, Pp, Ppk + confidence intervals
    reliability.py       F, R, f, z, H, AFR, lambda-hat, bounds, MTTF
    system.py            series / parallel, loss of cooling, dollars at risk
    specs.py             blood storage specification limits (cited)
    analyze.py           CSV logs -> status report
  app.py                 FastAPI routes (thin)
  tests/                 57 pytest tests: course known answers, degenerate cases, planted signals
  testme.sh manifestme.sh deployme.sh README.md
app/web/                 React (Vite) dashboard: Overview, Temperature, Generators, Upload, Methods
data/                    3 test scenarios + codebook + make_datasets.py (seeded)
demo/README.md           the guided demonstration
docs/                    SIX_SIGMA_METHODS.md, plan.md, OPEN_QUESTIONS.md, HANDOFF.md, images/
SPEC.md, CONTRACT.yaml   the hackathon spec and task ledger
SixSigma_README.md       the original event README (rules, links)
```

## Function and endpoint reference

- Library functions, inputs, outputs and the formula behind each: **[app/api/README.md](app/api/README.md)**
- Dashboard: **[app/web/README.md](app/web/README.md)**
- REST endpoints: the table in app/api/README.md, or http://localhost:8000/docs

## Assumptions and limits (we can explain every number)

- Test data are **synthetic** (seed 5300), shaped like real logs. Unit values ($/unit) are illustrative inputs.
- Readings are treated as independent; autocorrelated readings would raise false alarms.
- Generator running failures are modelled as exponential (constant hazard); ageing wear-out (Weibull m > 1) is not modelled.
- Grid and generator are assumed independent; a storm that hits both (common cause) makes P(loss) optimistic.
- Storage specs: 21 CFR 640.11, 640.34, 640.25 and AABB Standards. Generator test cadence follows the NFPA 110 pattern.
- The MR-chart upper limit uses D4 = 3.267 (course slides and lecture), not the ≈3.66 in the course helper `limits_mr()`.

## Credits

Team AirX: Owyn Adams, Jake Janish, Roman Nagirniak, Nkenna Opara, Carter Perun.
Methods from SYSEN 5300 (Dr. Timothy Fraser, Cornell): [textbook](https://timothyfraser.com/sigma/) ·
[course code](https://github.com/timothyfraser/sysen) · [hackathon repo](https://github.com/timothyfraser/sixsigmahackathon).
Two course datasets (`daily_production.csv`, `onsen.csv`) are copied into `app/api/tests/fixtures/` as
known-answer checks. Built with AI coding assistance (allowed and encouraged for the hackathon); the team
reviewed every statistic against the course's known answers.
