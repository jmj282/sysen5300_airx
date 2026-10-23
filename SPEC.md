# SPEC: Six Sigma Hackathon team project

What your tool IS. Your agent reads this before every task. Where the code and this file
disagree, the code is the bug: change this file first, then the code.

Filled in for **AirX ColdChain QC** (2026-10-21). Method details: [`docs/SIX_SIGMA_METHODS.md`](docs/SIX_SIGMA_METHODS.md);
build plan: [`docs/plan.md`](docs/plan.md); agent hand-off: [`docs/HANDOFF.md`](docs/HANDOFF.md).

## 1. Team and prompt
- **Team name:** AirX (Owyn Adams, Jake Janish, Roman Nagirniak, Nkenna Opara, Carter Perun)
- **Track:** Virtual DL Challenge (7 days), due Fri Oct 23, 3 PM ET. See [`SixSigma_README.md`](SixSigma_README.md).
- **Prompt we chose:** DL Challenge, Health Care Systems: **Blood Banks**. "A regional blood bank loses thousands of dollars of supply when older refrigeration units fail or backup generators don't start during blackouts. Design a tool to track blood bank supply integrity and flag/predict failures."
- **Our public repo:** https://github.com/jmj282/sysen5300_airx

## 2. User and use case (rubric: scope 5, user and use case 5)
- **User:** the blood bank's storage and quality technician, who logs each unit's thermometer every 4 hours and signs the generator test logbook.
- **Decision the tool helps them make, and when:** at each shift change, whether to service a refrigeration unit or move its inventory *before* it goes out of spec, and whether a backup generator must be repaired before the next storm.
- **Why this matches the prompt:** it tracks supply integrity (storage temperature vs regulatory spec) and flags or predicts the prompt's two failure modes: failing refrigeration units and generators that don't start.

## 3. Inputs (rubric: minimal inputs 5)
Only what this user already records on paper. No sensors or telemetry (the Devpost "data collection challenge").

| Input | Type and units | Where the user gets it |
|---|---|---|
| `units.csv`, one row per storage unit | unit_id, unit_type (RBC / PLASMA / PLATELETS), backup_generator, units_stored (count), value_per_unit (USD) | equipment list, inventory count, finance |
| `temperature_log.csv`, one row per reading | timestamp, unit_id, temp_c (°C, 0.1 resolution) | the temperature chart on each unit, read every 4 h |
| `generator_log.csv`, one row per start demand | test_date, generator_id, test_type, started (1/0), run_hours (h), run_failure (1/0) | the generator logbook + engine hour meter |

Codebook: [`data/README.md`](data/README.md).

## 4. The statistics, and why (rubric: valid QC analysis 25)
- **Method:**
  1. Per storage unit: an **Individuals and Moving Range (I-MR) chart** with limits x̄ ± 2.66·mR̄ (σ_short = mR̄/1.128) and MR upper 3.267·mR̄, estimated from a 14-day baseline; the course's **8 run rules**, with a status change on a confirmed signal (≥3 signalling readings in 24 h); **Cp, Cpk, Pp, Ppk** against the regulatory storage spec, with theoretical 95% CIs.
  2. Per generator: a **p chart** of failed starts per quarter (p̄ from baseline quarters; exact binomial limits when n·p̄ < 5); **exponential reliability** λ̂ = r/T, R(t) = e^(−λt), MTTF = 1/λ, k-factor upper bound χ²(0.95, 2(r+1))/2T.
  3. Site: **series/parallel system reliability**, P(loss of cooling in a t-hour blackout) = 1 − p_start·R(t), and dollars at risk = inventory × P(loss).
- **Why it fits the use case:** manual readings are individual values (n = 1), so I-MR; start tests are pass/fail demands, so a p chart; generator running time is a lifetime, so reliability; the blackout question is a block diagram.
- **Assumptions and how the tool checks them:** independence of readings (stated; autocorrelation would raise false alarms); stable baseline before capability (checked: capability is flagged when the baseline itself has confirmed signals); constant hazard for generators (stated; Weibull wear-out out of scope); binomial-normal approximation (checked: n·p̄ < 5 switches to exact limits); grid/generator independence (stated, common-cause caveat in the UI).
- **Known-answer check:** I-MR on the course's `daily_production.csv` gives limits 2118 / 3602 (Lesson 5, slide 33); Cp on `onsen.csv` = 0.67131, 95% CI [0.5958, 0.7468]; R(1000, 1/2000) = 0.60653; p chart p̄ = 0.067929, upper 0.1434 at n = 100; parallel(0.9, 0.9) = 0.99. All in `app/api/tests/`.

Fixed for every team:
- The statistic lives in **one plain, tested function** (`app/qc.py` or `app/qc.R`). The API, app or
  package only calls it and displays the result. No statistics inside UI code. *(Ours: the `app/api/bloodbank_qc/` package, one module per method.)*
- Every statistic has a test against a known answer and a degenerate case (constant data, n = 1, missing values).
- You can explain every number the tool prints. If you cannot, it is not done.

## 5. Delivery (rubric: working tool 25)
- **Stack:** Python library (`bloodbank_qc`) + REST API (FastAPI) + dashboard (React, Vite).
- **Starting demo:** `demos/fastapi/` → `app/api/`, and `demos/reactfront/` → `app/web/` (the fastapi-react-scaffold shape).

Fixed for every team:
- Keep the four-script contract (`testme`, `manifestme`, `deployme`, `README.md`) in each app folder;
  `testme` starts the tool with one command.
- Deployed on the course **Posit Connect** server with a public URL (publisher key handed out at the
  event). **Status: the DL key is not confirmed yet; see [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md) Q1.**
- A small tool that runs beats a large tool that does not.

## 6. Outputs
- **What the user sees:** for every unit and generator a status (Normal / Warning / Critical / Review) with the Six Sigma reason ("Rule 5: six readings in a row increasing"); an I chart with the control band, dashed spec lines and flagged points; capability indices with CIs and a verdict; a generator p chart and R(t) curve; P(loss of cooling) and dollars at risk; a ranked action list. Each chart has a one-line "How to read this".

## 7. Test datasets and codebook (rubric: demo 10, datasets 5, codebook 5)
- **Datasets:** `data/normal_operation/` (all stable), `data/temperature_degradation/` (R-04 compressor drift from day 17; R-07 set-point shift on day 24), `data/generator_failure/` (G-02 failing starts incl. the Oct 6 blackout). Each has `units.csv`, `temperature_log.csv`, `generator_log.csv`, regenerated by `data/make_datasets.py` (seed 5300). Demo walkthrough: [`demo/README.md`](demo/README.md).

## 8. Documentation and reproducibility (rubric: docs 10, public repo 5)
- `README.md` says what the tool does, for whom, every input and parameter, how to run it in one
  command, and walks through the demo on each test dataset.
- Public GitHub repo; a fresh clone runs `testme` and the tests pass with no extra steps.
- Submit on Devpost: the repo link plus the demonstration: the guided tour `demo/README.md` and the screenshot walkthrough `docs/WALKTHROUGH.md` (Ed #196: these count as the demonstration; no video).

## 9. Out of scope
- Default: logins, databases, real customer data, a second statistic before the first one is tested.
- No LLM/AI-agent analysis (alerts are rule-based statistics); no live sensor feeds; no multi-site comparison; no forecasting beyond run rules and R(t); Weibull wear-out modelling is a stretch goal.
