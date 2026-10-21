"""Tests for capability.py against SYSEN 5300 known answers."""

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from bloodbank_qc import capability as cap

FIX = Path(__file__).parent / "fixtures"


# ---------- course docstring examples ----------
def test_course_docstring_values():
    assert cap.cp(2, 100, 80) == pytest.approx(1.6667, abs=1e-4)
    assert cap.pp(2.5, 100, 80) == pytest.approx(1.3333, abs=1e-4)
    assert cap.cpk(90, 2, 80, 100) == pytest.approx(1.6667, abs=1e-4)
    assert cap.ppk(90, 2.5, 80, 100) == pytest.approx(1.3333, abs=1e-4)


def test_granola_lecture_example():
    # 2 +/- 0.05 spec, sigma 0.02, mean 2.01 -> Cp 0.8333, Cpk 0.6667
    assert cap.cp(0.02, 2.05, 1.95) == pytest.approx(0.8333, abs=1e-4)
    assert cap.cpk(2.01, 0.02, 1.95, 2.05) == pytest.approx(0.6667, abs=1e-4)


# ---------- onsen.csv: Cp with its theoretical CI (06 recitation) ----------
def onsen_sigmas():
    d = pd.read_csv(FIX / "onsen.csv")
    g = d.groupby("time")["temp"]
    s = g.std(ddof=1)
    nw = g.size()
    dfree = nw - 1
    sigma_s = float(np.sqrt((dfree * s**2).sum() / dfree.sum()))
    sigma_t = float(d["temp"].std(ddof=1))
    return float(d["temp"].mean()), sigma_s, sigma_t, int(dfree.sum())


def test_onsen_cp_and_ci():
    mu, sigma_s, sigma_t, v = onsen_sigmas()
    assert sigma_s == pytest.approx(1.98617, abs=1e-4)
    assert sigma_t == pytest.approx(1.98950, abs=1e-4)
    est = cap.cp(sigma_s, 50, 42)
    assert est == pytest.approx(0.67131, abs=1e-4)
    assert v == 152
    lo, hi = cap.index_ci(est, v, 160, kind="centered")
    assert lo == pytest.approx(0.5958, abs=1e-3)
    assert hi == pytest.approx(0.7468, abs=1e-3)


def test_onsen_cpk_pp_ppk():
    mu, sigma_s, sigma_t, _ = onsen_sigmas()
    assert cap.cpk(mu, sigma_s, 42, 50) == pytest.approx(0.47831, abs=1e-4)
    assert cap.pp(sigma_t, 50, 42) == pytest.approx(0.67018, abs=1e-4)
    assert cap.ppk(mu, sigma_t, 42, 50) == pytest.approx(0.47751, abs=1e-4)


def test_identity_pp_cpk_equals_ppk_cp():
    mu, s, t = 4.2, 0.3, 0.4
    assert cap.pp(t, 6, 1) * cap.cpk(mu, s, 1, 6) == pytest.approx(cap.ppk(mu, t, 1, 6) * cap.cp(s, 6, 1))


# ---------- one-sided spec (plasma: at or below -18 C) ----------
def test_one_sided_upper_only():
    # mean -25, sigma 1 -> (-18 - -25) / 3 = 2.333
    assert cap.cpk(-25, 1.0, lower=None, upper=-18) == pytest.approx(7 / 3)
    assert cap.cp(1.0, -18, None) is None  # Cp needs both limits


def test_mean_outside_spec_gives_negative_cpk():
    assert cap.cpk(7.0, 0.5, 1, 6) < 0


# ---------- degenerate cases ----------
def test_zero_sigma_is_undefined_not_a_number():
    assert cap.cp(0, 6, 1) is None
    assert cap.cpk(4, 0, 1, 6) is None
    assert cap.index_ci(None, 10, 11) == (None, None)


def test_report_verdicts():
    good = cap.capability_report(3.5, 0.2, 0.25, 84, 1, 6)
    assert good["verdict"].startswith("capable")
    bad = cap.capability_report(5.5, 0.6, 0.7, 84, 1, 6)
    assert bad["verdict"].startswith("not capable")
