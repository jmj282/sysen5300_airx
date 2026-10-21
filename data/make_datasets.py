"""Generate the three AirX ColdChain QC test scenarios (synthetic data; no real blood bank records).

    python data/make_datasets.py            # writes data/<scenario>/*.csv

Every scenario has the same 12 storage units and 2 backup generators, and the same three files:
  units.csv            the inventory list (one row per storage unit)
  temperature_log.csv  manual thermometer readings every 4 hours for 30 days
  generator_log.csv    3 years of weekly exercise tests, monthly load tests and real outages

Planted signals (see data/README.md for the full codebook):
  normal_operation         nothing: every unit stable and in spec, both generators healthy
  temperature_degradation  R-04's compressor degrades from day 17 (a slow upward drift that crosses
                           6 C around day 24); R-07's set point shifts up 0.6 C on day 24 (still in spec)
  generator_failure        G-02's starter degrades in the last two months: 8 failed starts in the last
                           90 days, including the 2026-10-06 blackout and the latest test on
                           2026-10-19, plus 2 run failures in its history; G-01 healthy

The numbers are invented but shaped like real logs: readings rounded to 0.1 C (a typical digital
thermometer), 6 readings a day, and a weekly 15-minute exercise plus a monthly 30-minute load test
(the NFPA 110 pattern for emergency generators).
"""

from pathlib import Path

import numpy as np
import pandas as pd

OUT = Path(__file__).parent
SEED = 5300  # fixed so every clone regenerates identical files
START = pd.Timestamp("2026-09-21 00:00")
DAYS = 30
PER_DAY = 6  # every 4 hours
GEN_START = pd.Timestamp("2023-10-23")
GEN_END = pd.Timestamp("2026-10-19")

UNITS = [
    # unit_id, unit_type, backup_generator, units_stored, value_per_unit (USD, illustrative)
    ("R-01", "RBC", "G-01", 120, 215),
    ("R-02", "RBC", "G-01", 120, 215),
    ("R-03", "RBC", "G-01", 120, 215),
    ("R-04", "RBC", "G-01", 120, 215),
    ("R-05", "RBC", "G-02", 120, 215),
    ("R-06", "RBC", "G-02", 120, 215),
    ("R-07", "RBC", "G-02", 120, 215),
    ("R-08", "RBC", "G-02", 120, 215),
    ("F-01", "PLASMA", "G-01", 300, 50),
    ("F-02", "PLASMA", "G-02", 300, 50),
    ("P-01", "PLATELETS", "G-01", 40, 550),
    ("P-02", "PLATELETS", "G-02", 40, 550),
]

# In-control behaviour per product type: set point spread across units, and reading-to-reading sd.
BEHAVIOUR = {
    "RBC": {"mean": 4.0, "unit_spread": 0.3, "sd": 0.30},
    "PLASMA": {"mean": -26.0, "unit_spread": 1.0, "sd": 1.20},
    "PLATELETS": {"mean": 22.0, "unit_spread": 0.2, "sd": 0.35},
}


def temperatures(rng, scenario):
    times = START + pd.to_timedelta(np.arange(DAYS * PER_DAY) * 4, unit="h")
    day = np.arange(times.size) / PER_DAY
    rows = []
    for unit_id, utype, *_ in UNITS:
        b = BEHAVIOUR[utype]
        center = b["mean"] + rng.uniform(-b["unit_spread"], b["unit_spread"])
        x = center + rng.normal(0, b["sd"], times.size)
        if scenario == "temperature_degradation":
            if unit_id == "R-04":
                # Compressor wear: +0.045 C per reading (about +0.27 C/day) from day 17.
                k = np.clip(np.arange(times.size) - 17 * PER_DAY, 0, None)
                x = x + 0.045 * k
            if unit_id == "R-07":
                # Thermostat knocked up 0.6 C (about 2 sigma) on day 24: unstable but still in spec.
                x = x + np.where(day >= 24, 0.6, 0.0)
        for t, v in zip(times, x):
            rows.append((t.strftime("%Y-%m-%d %H:%M"), unit_id, round(float(v), 1)))
    return pd.DataFrame(rows, columns=["timestamp", "unit_id", "temp_c"])


def site_outages(rng):
    """Real grid blackouts at the site, shared by both generators: about 6 a year, 1-12 hours long."""
    n_out = rng.poisson(6 * 3)
    days = sorted(rng.choice(pd.date_range(GEN_START, GEN_END, freq="D"), n_out, replace=False))
    return [(pd.Timestamp(d), float(np.clip(rng.lognormal(1.2, 0.7), 1, 12))) for d in days]


def generator_log(rng, gen_id, failing, outages):
    rows = []
    mondays = pd.date_range(GEN_START, GEN_END, freq="W-MON")
    first_mondays = [d for d in mondays if d.day <= 7]
    events = [(d, "weekly_exercise", 0.25) for d in mondays]
    events += [(d, "monthly_load", 0.5) for d in first_mondays]
    events += [(d, "outage", hours) for d, hours in outages]
    if not any(d == pd.Timestamp("2026-10-06") for d, _ in outages):
        # The blackout that started it all (both generators see it; G-02 fails to start in the
        # generator_failure scenario).
        events.append((pd.Timestamp("2026-10-06"), "outage", 6.0))
    events.sort(key=lambda e: (e[0], e[1]))

    recent_cut = GEN_END - pd.Timedelta(days=60)
    for d, kind, hours in events:
        p_fail_start = 0.005
        if failing and d >= recent_cut:
            p_fail_start = 0.45  # battery/starter problem in the last two months
        started = int(rng.random() >= p_fail_start)
        if failing and d == pd.Timestamp("2026-10-06") and kind == "outage":
            started = 0
        if failing and d == GEN_END.normalize() - pd.Timedelta(days=GEN_END.dayofweek):
            started = 0  # the most recent test also fails
        run_failure = 0
        run_hours = hours if started else 0.0
        if started:
            lam = 1 / 3000
            if rng.random() < 1 - np.exp(-lam * hours):
                run_failure = 1
        rows.append([d.strftime("%Y-%m-%d"), gen_id, kind, started, round(run_hours, 2), run_failure])

    df = pd.DataFrame(rows, columns=["test_date", "generator_id", "test_type", "started", "run_hours", "run_failure"])
    if failing:
        # Two documented run failures: stopped 3 h into the most recent outage it started for (before
        # the October blackout), and 0.2 h into the August 2026 load test.
        i = df.index[(df["test_type"] == "outage") & (df["started"] == 1) & (df["test_date"] < "2026-10-01")]
        if len(i):
            df.loc[i[-1], ["run_hours", "run_failure"]] = [3.0, 1]
        j = df.index[(df["test_type"] == "monthly_load") & (df["started"] == 1) & (df["test_date"] >= "2026-08-01")]
        if len(j):
            df.loc[j[0], ["run_hours", "run_failure"]] = [0.2, 1]
    return df


def build(scenario, seed):
    rng = np.random.default_rng(seed)
    units = pd.DataFrame(UNITS, columns=["unit_id", "unit_type", "backup_generator", "units_stored", "value_per_unit"])
    temps = temperatures(rng, scenario)
    outages = site_outages(rng)
    gens = pd.concat(
        [
            generator_log(rng, "G-01", failing=False, outages=outages),
            generator_log(rng, "G-02", failing=(scenario == "generator_failure"), outages=outages),
        ],
        ignore_index=True,
    )
    return units, temps, gens


def main(seed=SEED):
    for scenario in ["normal_operation", "temperature_degradation", "generator_failure"]:
        units, temps, gens = build(scenario, seed)
        d = OUT / scenario
        d.mkdir(exist_ok=True)
        units.to_csv(d / "units.csv", index=False)
        temps.to_csv(d / "temperature_log.csv", index=False)
        gens.to_csv(d / "generator_log.csv", index=False)
        print(f"{scenario}: {len(units)} units, {len(temps)} readings, {len(gens)} generator events")


if __name__ == "__main__":
    main()
