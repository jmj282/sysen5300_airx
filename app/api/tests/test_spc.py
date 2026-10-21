"""Tests for spc.py: known answers from SYSEN 5300, degenerate cases, and a planted signal per rule.

Known answers come from Dr. Fraser's course data (github.com/timothyfraser/sysen, workshops/), copied
into tests/fixtures/ for reproducibility.
"""

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from bloodbank_qc import spc

FIX = Path(__file__).parent / "fixtures"


# ---------- I-MR known answer: daily_production.csv (Lesson 5, slide 33: LCL 2118, UCL 3603) ----------
def test_imr_daily_production_known_answer():
    x = pd.read_csv(FIX / "daily_production.csv")["production"]
    lim = spc.imr_limits(x)
    assert lim["n"] == 25
    assert lim["xbar"] == pytest.approx(2860.28, abs=0.01)
    assert lim["mrbar"] == pytest.approx(279.0417, abs=1e-3)
    assert lim["sigma_s"] == pytest.approx(247.377, abs=1e-2)
    assert lim["sigma_t"] == pytest.approx(257.670, abs=1e-2)
    # x-bar +/- 3 * mRbar / 1.128 (the slide rounds to 2118 / 3603)
    assert lim["lower"] == pytest.approx(2118.15, abs=0.05)
    assert lim["upper"] == pytest.approx(3602.41, abs=0.05)
    assert round(lim["lower"]) == 2118 and round(lim["upper"]) == 3602
    # MR chart: D4 * mRbar = 3.267 * 279.0417 (slides); Fraser's helper would give about 1021
    assert lim["mr_upper"] == pytest.approx(3.267 * 279.0417, abs=1e-3)
    assert lim["mr_upper"] == pytest.approx(911.6, abs=0.5)
    assert lim["mr_lower"] == 0


def test_imr_daily_production_no_signals():
    x = pd.read_csv(FIX / "daily_production.csv")["production"].to_numpy()
    lim = spc.imr_limits(x)
    rule1 = [h for h in spc.run_rules(x, lim["xbar"], lim["sigma_s"]) if h["rule"] == 1]
    assert rule1 == []


def test_i_factor_is_2_66():
    assert spc.I_FACTOR == pytest.approx(2.66, abs=0.001)


def test_moving_range_hand_calc():
    assert spc.moving_range([4.0, 4.5, 4.1, 4.1]).tolist() == pytest.approx([0.5, 0.4, 0.0])


# ---------- degenerate cases ----------
def test_imr_constant_data_has_zero_width_and_no_rules():
    lim = spc.imr_limits([4.0] * 20)
    assert lim["mrbar"] == 0 and lim["sigma_s"] == 0
    assert lim["upper"] == lim["lower"] == 4.0
    assert spc.run_rules([4.0] * 20, lim["xbar"], lim["sigma_s"]) == []


def test_imr_needs_two_points():
    with pytest.raises(ValueError):
        spc.imr_limits([4.0])


def test_imr_ignores_missing_values():
    lim = spc.imr_limits([4.0, np.nan, 4.2, 4.4])
    assert lim["n"] == 3


# ---------- planted signals: each rule fires where we put it ----------
def rules_at(x, center=0.0, sigma=1.0):
    return {(h["rule"], h["index"]) for h in spc.run_rules(np.asarray(x, float), center, sigma)}


def test_rule1_single_point_beyond_3_sigma():
    x = [0.1, -0.2, 0.3, 3.5, 0.0]
    assert (1, 3) in rules_at(x)


def test_rule2_two_of_three_beyond_2_sigma():
    x = [0.1, 2.5, 0.2, 2.4, 0.0]
    hits = rules_at(x)
    assert (2, 3) in hits and not any(r == 1 for r, _ in hits)


def test_rule3_four_of_five_beyond_1_sigma():
    x = [0.0, 1.5, 1.2, 0.5, 1.4, 1.3]
    assert (3, 5) in rules_at(x)


def test_rule4_eight_same_side():
    x = [-0.5] + [0.4] * 8
    assert (4, 8) in rules_at(x)
    assert (4, 7) not in rules_at(x)


def test_rule5_six_increasing():
    x = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5]
    assert (5, 5) in rules_at(x)
    assert (5, 4) not in rules_at(x)


def test_rule5_six_decreasing():
    x = [0.5, 0.4, 0.3, 0.2, 0.1, 0.0]
    assert (5, 5) in rules_at(x)


def test_rule6_fifteen_in_zone_c():
    x = [0.5, -0.5] * 7 + [0.3]
    assert (6, 14) in rules_at(x)


def test_rule7_eight_outside_zone_c_both_sides():
    x = [1.5, -1.5] * 4
    assert (7, 7) in rules_at(x)


def test_rule8_fourteen_alternating():
    x = [0.2, -0.2] * 7
    assert (8, 13) in rules_at(x)
    assert (8, 12) not in rules_at(x)


def test_in_control_sample_rarely_fires_rule1():
    rng = np.random.default_rng(1)
    x = rng.normal(0, 1, 1000)
    n1 = sum(1 for h in spc.run_rules(x, 0, 1) if h["rule"] == 1)
    assert n1 < 10  # expected about 2.7 per 1000 (the 0.27% false-alarm rate of 3-sigma limits)


# ---------- p chart ----------
def test_p_chart_course_inventory_example():
    # ggp() docstring "inventory" data: 104 defects in 1531 items over 17 weeks, pbar = 0.067929,
    # and a week with n = 100 has an upper limit of 0.1434 (Lesson 5, slide 45).
    pc = spc.p_chart([7, 97], [100, 1431])
    assert pc["pbar"] == pytest.approx(0.067929, abs=1e-6)
    assert pc["upper"][0] == pytest.approx(0.1434, abs=1e-4)
    assert pc["lower"][0] == 0.0


def test_p_chart_limits_per_period_and_signal():
    pc = spc.p_chart([0, 0, 0, 0, 3], [5, 5, 5, 5, 5])
    assert pc["pbar"] == pytest.approx(3 / 25)
    se = np.sqrt(0.12 * 0.88 / 5)
    assert pc["upper"][0] == pytest.approx(0.12 + 3 * se)
    assert pc["lower"][0] == 0.0  # clipped at 0
    assert pc["signal"] == [False, False, False, False, True]


def test_p_chart_degenerate_no_failures():
    pc = spc.p_chart([0, 0, 0], [5, 5, 5])
    assert pc["pbar"] == 0 and pc["upper"] == [0, 0, 0] and not any(pc["signal"])


def test_p_chart_rejects_bad_input():
    with pytest.raises(ValueError):
        spc.p_chart([1], [0])
    with pytest.raises(ValueError):
        spc.p_chart([6], [5])
