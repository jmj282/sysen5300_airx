# AirX ColdChain QC: Python library + REST API

`bloodbank_qc` is a plain Python library (pandas, numpy, scipy) holding every statistic. `app.py` is a
thin FastAPI layer over it. The library never imports FastAPI, so every statistic is testable on its own.

## Run

```bash
./testme.sh          # one command: creates ../../.venv if needed, runs the tests, serves on :8000
# interactive docs:  http://localhost:8000/docs
```

Tests only: `../../.venv/bin/python -m pytest` (from this folder). 59 tests (listed in [docs/TESTS.md](../../docs/TESTS.md)): course known answers
(Fraser's `daily_production.csv`, `onsen.csv`, docstring and lecture examples), degenerate cases
(constant data, zero failures, n = 1) and a planted signal for every run rule.

## REST endpoints

| Method | Path | Input | Returns |
|---|---|---|---|
| GET | `/` | – | health check |
| GET | `/specs` | – | storage specification limits per product type |
| GET | `/datasets` | – | the three bundled scenarios |
| GET | `/datasets/{scenario}/{file}` | – | download a sample CSV |
| GET | `/analyze/{scenario}` | query: `baseline_days` (14), `window_days` (7), `outage_hours` (8), `confirm_count` (3) | full report (below) |
| POST | `/analyze` | multipart: `units`, `temperature_log`, `generator_log` CSVs; same query params | full report; 422 with a readable message if a column is missing |
| POST | `/spc/imr` | `{"values": [...], "baseline_n": 20}` | I-MR limits + every run-rule hit |
| POST | `/capability` | `{"values": [...], "lower": 1, "upper": 6}` (either limit may be null) | Cp, Cpk, Pp, Ppk with 95% CIs + verdict |
| POST | `/reliability/generator` | `{"starts", "demands", "run_failures", "run_hours", "outage_hours", "inventory_value"}` | p_start (+ lower bound), λ̂, λ_upper, MTTF, R(t), P(loss), $ at risk |

**Full report shape** (`/analyze`): `overview` (tiles), `units[]` (status, reason, limits, hits,
excursions, lead_hours, capability, chart series), `generators[]` (status, start, running, p_chart,
reliability_curve, p_backup, p_loss, dollars_at_risk), `actions[]` (ranked), `params`.

## Library functions

### `bloodbank_qc.spc`: statistical process control

| Function | Inputs | Output | Formula (course notation) |
|---|---|---|---|
| `moving_range(x)` | readings | array | mR_t = \|x_t − x_(t−1)\| |
| `imr_limits(x_baseline)` | ≥2 baseline readings | dict `n, xbar, mrbar, sigma_s, sigma_t, upper, lower, mr_upper, mr_lower` | σ_short = mR̄/1.128; limits x̄ ± 3σ_short (= x̄ ± 2.66 mR̄); MR upper = 3.267 mR̄ |
| `run_rules(x, center, sigma_s)` | readings, centre, σ_short | list of `{rule, index, description}` | the course's 8 visual tests (Lesson 5, slide 60); empty if σ_short = 0 |
| `p_chart(failures, demands, baseline=None, method="auto")` | counts per period | dict `pbar, p, upper, lower, signal, method, small_n, baseline` | p̄ from baseline periods; p̄ ± 3√(p̄(1−p̄)/n), or exact binomial limits when n·p̄ < 5 |

Constants: `D2_N2 = 1.128`, `D4_N2 = 3.267`, `I_FACTOR = 3/1.128 = 2.66`. `WARNING_RULES = {1..5}`, `REVIEW_RULES = {6,7,8}`.

### `bloodbank_qc.capability`

| Function | Output | Formula |
|---|---|---|
| `cp(sigma_s, upper, lower)` | float or None | \|E_upper − E_lower\| / 6σ_short |
| `pp(sigma_t, upper, lower)` | float or None | \|E_upper − E_lower\| / 6σ_total |
| `cpk(mu, sigma_s, lower=None, upper=None)` | float or None | min(μ − E_lower, E_upper − μ) / 3σ_short (one-sided if one limit) |
| `ppk(mu, sigma_t, lower=None, upper=None)` | float or None | same with σ_total |
| `index_ci(estimate, v, n, kind, conf=0.95)` | (lower, upper) | centred SE = est·√(1/2v); k SE = est·√(1/2v + 1/(9n·est²)) |
| `capability_report(mu, sigma_s, sigma_t, n, lower, upper)` | dict of all four + CIs + verdict | v = n − 1 for individuals data |

Returns `None`, never a made-up number, when an index is undefined (σ = 0, or Cp with a one-sided spec).

### `bloodbank_qc.reliability`: exponential life distribution

| Function | Formula |
|---|---|
| `F(t, lambda_)`, `R(t, lambda_)` | 1 − e^(−λt), e^(−λt) |
| `f(t, lambda_)`, `z(t, lambda_)` | λe^(−λt) (density), f/R = λ (failure rate) |
| `H(t, lambda_)`, `afr(t1, t2, lambda_)` | λt; (H(t2) − H(t1))/(t2 − t1) |
| `lambda_hat(failures, total_time)` | r / T |
| `lambda_upper(failures, total_time, conf)` | χ²(conf, 2(r+1)) / 2T (= −ln(1−conf)/T at r = 0) |
| `lambda_lower(failures, total_time, conf)` | χ²(1−conf, 2r) / 2T |
| `mttf(lambda_)` | 1/λ (None if λ = 0) |
| `generator_reliability(failures, run_hours, outage_hours, conf)` | dict of all of the above at t = outage_hours |
| `binomial_start_probability(starts, demands, conf)` | p_start + exact (Clopper-Pearson) lower bound |

### `bloodbank_qc.system`

| Function | Formula |
|---|---|
| `series(*R)` / `parallel(*R)` | ΠR_i / 1 − Π(1 − R_i) |
| `backup_power(p_start, r_run)` | p_start × R(t) |
| `loss_of_cooling(p_start, r_run)` | 1 − p_start × R(t) |
| `dollars_at_risk(units, value, p_loss)` | units × value × P(loss) |

### `bloodbank_qc.analyze`

`analyze_dataset(units_df, temps_df, gens_df, params=None)` → the full report. Parameters (`DEFAULTS`):

| Parameter | Default | Meaning |
|---|---|---|
| `baseline_days` | 14 | phase I window for control limits |
| `window_days` | 7 | an excursion in this window makes a unit Critical |
| `confirm_hours`, `confirm_count` | 24, 3 | a run-rule status needs ≥3 signalling readings in 24 h |
| `outage_hours` | 8 | blackout length for R(t) and P(loss) |
| `backup_target` | 0.95 | generator Warning if P(backup carries the outage) is below this |
| `recent_test_days` | 90 | generator p-chart window judged against the baseline |

## Deploy (Posit Connect)

```bash
pip install rsconnect-python
./manifestme.sh      # copies data/ scenarios in, writes manifest.json
./deployme.sh        # needs CONNECT_SERVER and CONNECT_API_KEY in the gitignored ../../.env
```
