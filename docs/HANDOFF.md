# Agent hand-off: AirX ColdChain QC

For the next AI agent (or teammate) picking this up. Read this, then [`SPEC.md`](../SPEC.md),
[`CONTRACT.yaml`](../CONTRACT.yaml) and [`docs/SIX_SIGMA_METHODS.md`](SIX_SIGMA_METHODS.md). The repo-level
[`CLAUDE.md`](../CLAUDE.md) / [`AGENTS.md`](../AGENTS.md) are the course's generic hackathon rules and still apply.

## State (2026-10-21)

| Piece | Where | Status |
|---|---|---|
| Statistics library | `app/api/bloodbank_qc/` | done, 60 tests pass ([docs/TESTS.md](TESTS.md)) |
| REST API | `app/api/app.py` | done, runs locally (`app/api/testme.sh`) |
| Dashboard | `app/web/` | done, runs locally (`app/web/testme.sh`) |
| Test data + codebook | `data/` | done (seed 5300) |
| Demo walkthrough | `demo/README.md`, `docs/WALKTHROUGH.md` + `docs/images/walkthrough/` | done; the team records an OBS video separately. Retake screenshots after UI changes |
| README / function docs | `README.md`, `app/api/README.md`, `app/web/README.md` | done; needs a teammate fresh-clone check |
| Deploy (H-06) | `app/api/` (+ `manifest.json`, `data/`, `static/`), `.github/workflows/deploy-fastapi.yml` | **live**: public URL in `README.md` (logged-out checks return 200). Auto-redeploy Action waits on the repo secrets and a merge to `main` |
| Devpost + Canvas submission (H-08) | – | team; due Fri Oct 23, 3 PM ET (1 PM MT) |

Work happens on branch **`plan/blood-bank-tool`** with local commits. The team reviews, then merges to
`main` (Carter's decision, 2026-10-21). **Don't push or merge without a human yes.**

## How to run and check everything

```bash
app/api/testme.sh                                    # tests + API on :8000
app/web/testme.sh                                    # dashboard on :5173
(cd app/api && ../../.venv/bin/python -m pytest)     # tests only
python data/make_datasets.py                         # regenerate data (must be byte-identical)
```

## Rules this project follows (keep them)

1. **Statistics only in `bloodbank_qc/`.** No maths in `app.py` or React. The dashboard only draws API numbers.
2. **Course notation and formulas** (SYSEN 5300, Fraser): z(t) for the hazard rate, "control limits" vs
   "specification limits", σ_short / σ_total, E_lower / E_upper, MTTF (MTBF only as "= MTBF for a
   repaired generator"). See SIX_SIGMA_METHODS §9 for pitfalls.
3. **Every new statistic gets a known-answer test and a degenerate-case test** before any UI.
4. **Phase I / phase II.** Limits come from a baseline (first 14 days for temperatures; quarters
   before the last 90 days for the p chart). Never compute limits on the data being judged.
5. **Undefined is `None`, not a number** (σ = 0, zero failures → MTTF unbounded).
6. **Synthetic data is labelled synthetic.** If you change `make_datasets.py`, rerun the scenario check
   below and update every number in `data/README.md`, `demo/README.md` and `README.md`.

## Deliberate decisions (and why) — don't "fix" these

| Decision | Why | Where |
|---|---|---|
| MR upper limit = 3.267·mR̄, not the course helper's ≈3.66·mR̄ | slides and the 9/24 lecture use D4; the helper `limits_mr()` disagrees with them | `spc.imr_limits` |
| Status needs ≥3 signalling readings in 24 h | all 8 rules on every reading false-alarm ~48% of healthy units/week; this policy is ~1% with 97% shift detection (simulated) | `analyze.analyze_unit`, SIX_SIGMA_METHODS §2b |
| Capability shown with a caution when the baseline has confirmed signals | ~1 healthy unit in 6 shows a chance cluster in 84 baseline readings; hiding Cpk would mislead | `analyze.analyze_unit` |
| p chart per **quarter** with **exact binomial limits** when n·p̄ < 5 | with p̄ < 1% the normal-approximation limit flags a single failure | `spc.p_chart(method="auto")` |
| Rule-based alerts, no LLM | team decision; no API key; reproducible | OPEN_QUESTIONS |
| Both generators share the same outage history | same site, same blackouts | `make_datasets.site_outages` |

## Scenario check (run after any change to data or analysis)

Expected statuses, otherwise something broke:

- `normal_operation`: all 14 Normal
- `temperature_degradation`: R-04 Critical (lead ≈124 h), R-07 Warning, rest Normal
- `generator_failure`: G-02 Critical (p-chart signals 2026Q3, 2026Q4), rest Normal

`app/api/tests/test_analyze.py` asserts these.

## Good next tasks (each needs a teammate's yes; add to CONTRACT.yaml as H-09+)

1. **Deploy** (H-06): done by hand on 2026-10-22; one app serves the API and the dashboard, so
   `VITE_API_URL` and `app/web/deployme.sh` are no longer needed. Left: add the `CONNECT_SERVER` and
   `CONNECT_API_KEY` repo secrets, merge to `main`, and watch the Action run green.
2. **Fresh-clone check** (H-08): clone into an empty folder; run both `testme.sh` scripts.
3. **Weibull wear-out check** for generators (shape m > 1?), course chapter "Useful Life Distributions:
   Weibull". Stretch goal only after the above.
4. **Re-baseline button**: after a repair, recompute a unit's limits from a chosen start date.
5. **Decide what to do with the root `fastapi/` folder** (Jake's copy of the course demo). It's
   superseded by `app/api/` but left in place until the team agrees to delete it.
