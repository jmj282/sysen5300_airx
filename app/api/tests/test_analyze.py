"""End-to-end tests on the three bundled scenarios: each planted signal shows up where we put it,
and the in-control scenario raises no alerts."""

from pathlib import Path

import pandas as pd
import pytest

from bloodbank_qc.analyze import InputError, analyze_dataset

DATA = Path(__file__).resolve().parents[3] / "data"


def run(scenario):
    d = DATA / scenario
    return analyze_dataset(
        pd.read_csv(d / "units.csv"), pd.read_csv(d / "temperature_log.csv"), pd.read_csv(d / "generator_log.csv")
    )


def status(report):
    return {**{u["unit_id"]: u["status"] for u in report["units"]}, **{g["generator_id"]: g["status"] for g in report["generators"]}}


def test_normal_operation_is_all_normal_and_capable():
    r = run("normal_operation")
    assert set(status(r).values()) == {"Normal"}
    assert r["overview"]["active_alerts"] == 0
    for u in r["units"]:
        assert u["capability"]["cpk"]["estimate"] > 1.33
    # Healthy units can still show a confirmed false alarm in a 2-week baseline (about 1 in 6);
    # most baselines must read as stable.
    assert sum(u["baseline_stable"] for u in r["units"]) >= 9


def test_degradation_warns_days_before_the_excursion():
    r = run("temperature_degradation")
    s = status(r)
    assert s["R-04"] == "Critical" and s["R-07"] == "Warning"
    assert [k for k, v in s.items() if v != "Normal"] == ["R-04", "R-07"]
    r04 = next(u for u in r["units"] if u["unit_id"] == "R-04")
    assert r04["lead_hours"] >= 72  # the run rules fired at least 3 days before the first excursion
    assert r["actions"][0]["item"] == "R-04"


def test_generator_failure_flags_g02_with_p_chart_signal():
    r = run("generator_failure")
    s = status(r)
    assert s["G-02"] == "Critical" and s["G-01"] == "Normal"
    g2 = next(g for g in r["generators"] if g["generator_id"] == "G-02")
    assert any(g2["p_chart"]["signal"][-2:])  # the last two months signal
    assert g2["running"]["failures"] == 2
    assert g2["p_backup"] < 0.95
    assert g2["dollars_at_risk"] > 10_000  # "thousands of dollars of supply" from the prompt


def test_bad_upload_gives_readable_error():
    with pytest.raises(InputError, match="missing column"):
        analyze_dataset(pd.DataFrame({"unit_id": ["R-01"]}), pd.DataFrame(), pd.DataFrame())


def test_unknown_unit_type_is_rejected():
    units = pd.DataFrame([["X-1", "WHOLE_BLOOD", "G-01", 1, 1]], columns=["unit_id", "unit_type", "backup_generator", "units_stored", "value_per_unit"])
    temps = pd.DataFrame(columns=["timestamp", "unit_id", "temp_c"])
    gens = pd.DataFrame(columns=["test_date", "generator_id", "test_type", "started", "run_hours", "run_failure"])
    with pytest.raises(InputError, match="Unknown unit_type"):
        analyze_dataset(units, temps, gens)
