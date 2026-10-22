# ✅ Tests: how we know the numbers are right

**60 automated tests** in [`app/api/tests/`](../app/api/tests/). Run them with:

```bash
app/api/testme.sh                                  # tests, then starts the API
# or tests only:
cd app/api && ../../.venv/bin/python -m pytest -v
```

Three kinds of check, following the hackathon's *stats-first* rule:

- **Known answer:** reproduces a number published in the SYSEN 5300 course (Dr. Fraser's datasets, slides, lecture examples or helper-function docstrings).
- **Degenerate case:** constant data, zero failures, too few points or bad input must give "undefined" or a clear error, never a made-up number.
- **Planted signal:** a pattern we built in on purpose must be caught exactly where we put it.

Two course datasets are copied into [`app/api/tests/fixtures/`](../app/api/tests/fixtures/) for the known-answer tests: `daily_production.csv` and `onsen.csv` (from [github.com/timothyfraser/sysen](https://github.com/timothyfraser/sysen)).

---

## Statistical process control: `test_spc.py` (23 tests)

| Test | Checks | Kind |
|---|---|---|
| `test_imr_daily_production_known_answer` | I-MR on the course's `daily_production.csv`: x̄ = 2860.28, mR̄ = 279.04, σ_short = 247.38, limits 2118 / 3602 (Lesson 5 slide), MR upper = 3.267·mR̄ | known answer |
| `test_imr_daily_production_no_signals` | that in-control course data raises no Rule 1 points | known answer |
| `test_i_factor_is_2_66` | 3 / 1.128 = 2.66, the individuals-chart factor | known answer |
| `test_moving_range_hand_calc` | moving ranges of a short series match a hand calculation | known answer |
| `test_imr_constant_data_has_zero_width_and_no_rules` | constant readings → zero-width limits, no run-rule signals | degenerate |
| `test_imr_needs_two_points` | one reading → clear error | degenerate |
| `test_imr_ignores_missing_values` | blank readings are skipped, not counted | degenerate |
| `test_rule1_single_point_beyond_3_sigma` | Rule 1 fires on the planted point | planted signal |
| `test_rule2_two_of_three_beyond_2_sigma` | Rule 2 fires where planted (and Rule 1 doesn't) | planted signal |
| `test_rule3_four_of_five_beyond_1_sigma` | Rule 3 | planted signal |
| `test_rule4_eight_same_side` | Rule 4 fires on the 8th point, not the 7th | planted signal |
| `test_rule5_six_increasing` | Rule 5 (six rising, the failing-compressor pattern) fires on the 6th point | planted signal |
| `test_rule5_six_decreasing` | Rule 5 for a falling run | planted signal |
| `test_rule6_fifteen_in_zone_c` | Rule 6 | planted signal |
| `test_rule7_eight_outside_zone_c_both_sides` | Rule 7 | planted signal |
| `test_rule8_fourteen_alternating` | Rule 8 fires on the 14th point, not the 13th | planted signal |
| `test_in_control_sample_rarely_fires_rule1` | 1,000 random in-control points give about the expected 0.27% false-alarm rate | sanity |
| `test_p_chart_course_inventory_example` | p chart on the course's `ggp()` inventory data: p̄ = 0.067929, upper limit 0.1434 at n = 100 (Lesson 5 slide) | known answer |
| `test_p_chart_limits_per_period_and_signal` | per-period limits p̄ ± 3√(p̄(1−p̄)/n), clipped at 0, and the planted bad period flagged | planted signal |
| `test_p_chart_baseline_keeps_new_problem_out_of_its_own_limits` | p̄ comes from the baseline periods, so a new problem can't widen its own limits | method check |
| `test_p_chart_exact_limits_for_rare_failures` | with rare failures, exact binomial limits: 1 failure in 16 is normal, 4 is a signal | method check |
| `test_p_chart_degenerate_no_failures` | no failures at all → p̄ = 0, no signals | degenerate |
| `test_p_chart_rejects_bad_input` | 0 demands or more failures than demands → clear error | degenerate |

## Capability indices: `test_capability.py` (9 tests)

| Test | Checks | Kind |
|---|---|---|
| `test_course_docstring_values` | `cp(2, 100, 80)` = 1.6667, `pp` = 1.3333, `cpk` = 1.6667, `ppk` = 1.3333 (course helper examples) | known answer |
| `test_granola_lecture_example` | lecture example: spec 2 ± 0.05, σ = 0.02, μ = 2.01 → Cp 0.8333, Cpk 0.6667 | known answer |
| `test_onsen_cp_and_ci` | course `onsen.csv`: σ_short 1.98617, Cp 0.67131, 95% CI [0.5958, 0.7468] | known answer |
| `test_onsen_cpk_pp_ppk` | `onsen.csv`: Cpk 0.47831, Pp 0.67018, Ppk 0.47751 | known answer |
| `test_identity_pp_cpk_equals_ppk_cp` | the course identity Pp·Cpk = Ppk·Cp | identity |
| `test_one_sided_upper_only` | plasma-style one-sided spec (≤ −18 °C): Cpk works, Cp is undefined | method check |
| `test_mean_outside_spec_gives_negative_cpk` | a mean outside the spec gives a negative Cpk | method check |
| `test_zero_sigma_is_undefined_not_a_number` | σ = 0 → "undefined", not infinity or a made-up value | degenerate |
| `test_report_verdicts` | the verdict reads the Cpk interval correctly (capable / not capable) | method check |

## Reliability and system reliability: `test_reliability.py` (14 tests)

| Test | Checks | Kind |
|---|---|---|
| `test_course_exponential_values` | course `functions_reliability` examples: R(1000, 1/2000) = 0.60653, F(100, 0.01) = 0.63212, f, z = λ, AFR, F(8766, 1/1200) | known answer |
| `test_rotary_pump_example` | lecture rotary pump: λ = 4.28e-4/h → R(730) = 0.7317, MTTF = 2336.4 h | known answer |
| `test_F_plus_R_is_one_and_F_at_mttf` | F + R = 1, and F(MTTF) = 0.632 | identity |
| `test_phone_example_lambda_hat` | 5 failures in 500 unit-days → λ̂ = 0.01, MTTF = 100 | known answer |
| `test_zero_failure_upper_bound` | zero failures: λ_upper = −ln(0.05)/T (the course's special case) | known answer |
| `test_upper_bound_above_point_estimate` | lower bound < λ̂ < upper bound | sanity |
| `test_degenerate_zero_failures` | no failures → λ̂ = 0, MTTF "unbounded", R = 1 but its lower bound < 1 | degenerate |
| `test_bad_inputs` | zero run-time, or more starts than demands → clear error | degenerate |
| `test_start_probability_bound` | 150 of 150 starts → exact lower bound 0.05^(1/150) | known answer |
| `test_parallel_two_at_0_9` | two parallel parts at 0.9 → 0.99 | known answer |
| `test_challenger_series` | lecture Challenger example: 1 − 0.99⁸ = 0.07726 | known answer |
| `test_many_parts_series` | 3,500 parts at 0.9995 in series → 0.1737 | known answer |
| `test_backup_power_and_dollars` | backup = p_start × R(t); P(loss) and dollars at risk by hand | known answer |
| `test_system_rejects_non_probabilities` | reliabilities outside 0–1 → clear error | degenerate |

## Whole-dataset analysis: `test_analyze.py` (5 tests)

| Test | Checks | Kind |
|---|---|---|
| `test_normal_operation_is_all_normal_and_capable` | Normal dataset: all 14 items Normal, 0 alerts, every Cpk > 1.33 | planted signal (none) |
| `test_degradation_warns_days_before_the_excursion` | Temperature degradation: R-04 Critical, R-07 Warning, nothing else; R-04 flagged ≥ 72 h before its first excursion; R-04 is the first action | planted signal |
| `test_generator_failure_flags_g02_with_p_chart_signal` | Generator failure: G-02 Critical, G-01 Normal, p chart signals in the last two quarters, 2 run failures, P(backup) < 0.95, > $10,000 at risk | planted signal |
| `test_bad_upload_gives_readable_error` | an upload with missing columns gives a readable message | degenerate |
| `test_unknown_unit_type_is_rejected` | an unknown product type (not RBC / PLASMA / PLATELETS) is rejected | degenerate |

## REST API: `test_api.py` (9 tests)

| Test | Checks |
|---|---|
| `test_root_and_datasets` | the API runs and lists the three datasets |
| `test_root_serves_bundled_dashboard` | when the built dashboard is bundled (the deployed app), `/` serves it as HTML and `/datasets` still returns JSON |
| `test_analyze_scenario_matches_library` | `/analyze/temperature_degradation` gives the library's statuses |
| `test_upload_roundtrip_equals_bundled` | uploading a dataset's files gives exactly the same overview as the bundled version |
| `test_upload_bad_csv_is_422` | a bad upload returns HTTP 422 with a readable message |
| `test_imr_endpoint_known_answer` | `/spc/imr` reproduces the course limits 2118 / 3602 |
| `test_generator_endpoint` | `/reliability/generator` gives the hand-calculated P(loss) and dollars |
| `test_dataset_cards_and_zip_download` | dataset descriptions exist and the zip contains the CSVs and codebook |
| `test_dataset_explorer_codebook_summary_and_paging` | the Explorer endpoint returns the codebook, correct summaries (R-04 max 7.9 °C), paging and filtering |

---

The dashboard also has 3 small display tests (`app/web/src/format.test.js`, run with `npm test` in
`app/web`). They check that missing values show as "—" rather than a made-up number.
