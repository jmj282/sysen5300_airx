"""Tests for reliability.py and system.py against SYSEN 5300 known answers."""

import math

import pytest

from bloodbank_qc import reliability as rel
from bloodbank_qc import system


# ---------- failure functions (course functions_reliability examples) ----------
def test_course_exponential_values():
    assert float(rel.R(1000, 1 / 2000)) == pytest.approx(0.60653, abs=1e-5)
    assert float(rel.F(100, 0.01)) == pytest.approx(0.63212, abs=1e-5)
    assert float(rel.R(100, 0.01)) == pytest.approx(0.36788, abs=1e-5)
    assert float(rel.f(100, 0.01)) == pytest.approx(0.0036788, abs=1e-7)
    assert float(rel.z(0.5, 0.01)) == pytest.approx(0.01)  # constant hazard
    assert float(rel.afr(700, 900, 1 / 1000)) == pytest.approx(0.001)
    assert float(rel.F(8766, 1 / 1200)) == pytest.approx(0.99933, abs=1e-5)


def test_rotary_pump_example():
    lam = 4.28e-4
    assert float(rel.R(730, lam)) == pytest.approx(0.7317, abs=1e-4)
    assert rel.mttf(lam) == pytest.approx(2336.4, abs=0.1)


def test_F_plus_R_is_one_and_F_at_mttf():
    lam = 0.002
    assert float(rel.F(321, lam) + rel.R(321, lam)) == pytest.approx(1.0)
    assert float(rel.F(rel.mttf(lam), lam)) == pytest.approx(1 - math.exp(-1))  # 0.632


def test_phone_example_lambda_hat():
    # 5 failures in 500 unit-days -> lambda 0.01/day, MTTF 100 days
    lam = rel.lambda_hat(5, 500)
    assert lam == pytest.approx(0.01)
    assert rel.mttf(lam) == pytest.approx(100)


# ---------- confidence bounds (k-factor method) ----------
def test_zero_failure_upper_bound():
    # course special case: lambda_upper = -ln(1 - p) / T
    assert rel.lambda_upper(0, 120, 0.95) == pytest.approx(-math.log(0.05) / 120)


def test_upper_bound_above_point_estimate():
    assert rel.lambda_upper(3, 500) > rel.lambda_hat(3, 500) > rel.lambda_lower(3, 500)


def test_degenerate_zero_failures():
    out = rel.generator_reliability(0, 100, 8)
    assert out["lambda_hat"] == 0 and out["mttf"] is None  # unbounded, not a made-up number
    assert out["R_t"] == 1.0 and out["R_t_lower"] < 1.0


def test_bad_inputs():
    with pytest.raises(ValueError):
        rel.lambda_hat(1, 0)
    with pytest.raises(ValueError):
        rel.binomial_start_probability(6, 5)


def test_start_probability_bound():
    sp = rel.binomial_start_probability(150, 150)
    assert sp["p_start"] == 1.0
    assert sp["p_start_lower"] == pytest.approx(0.05 ** (1 / 150), abs=1e-6)  # exact bound with 0 failures


# ---------- system reliability (course examples) ----------
def test_parallel_two_at_0_9():
    assert system.parallel(0.9, 0.9) == pytest.approx(0.99)


def test_challenger_series():
    assert 1 - system.series(*([0.99] * 8)) == pytest.approx(0.07726, abs=1e-5)


def test_many_parts_series():
    assert 0.9995**3500 == pytest.approx(0.1737, abs=1e-4)
    assert system.series(*([0.9995] * 3500)) == pytest.approx(0.1737, abs=1e-4)


def test_backup_power_and_dollars():
    p = system.backup_power(0.9, 0.95)
    assert p == pytest.approx(0.855)
    assert system.loss_of_cooling(0.9, 0.95) == pytest.approx(0.145)
    assert system.dollars_at_risk(100, 200, 0.145) == pytest.approx(2900)


def test_system_rejects_non_probabilities():
    with pytest.raises(ValueError):
        system.parallel(1.2, 0.5)
    with pytest.raises(ValueError):
        system.dollars_at_risk(10, 10, 1.5)
