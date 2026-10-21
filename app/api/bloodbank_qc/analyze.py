"""Turn three CSV logs into a status report for every storage unit and generator.

This is the only module that knows about the CSV layout. Every number it reports comes from a plain,
tested function in spc.py, capability.py, reliability.py or system.py.

Inputs (codebook: data/README.md):
  units.csv            unit_id, unit_type, backup_generator, units_stored, value_per_unit
  temperature_log.csv  timestamp, unit_id, temp_c
  generator_log.csv    test_date, generator_id, test_type, started, run_hours, run_failure

DMAIC: this module is Analyze -> Improve. It applies the statistics (Analyze) and ranks the actions a
technician should take (Improve).
"""

import math

import numpy as np
import pandas as pd

from . import capability, reliability, spc, system
from .specs import get_spec, out_of_spec

DEFAULTS = {
    "baseline_days": 14,  # phase I: control limits come from the first 14 days of each unit
    "window_days": 7,  # excursions (out-of-spec readings) in the last 7 days make a unit Critical
    "confirm_hours": 24,  # run-rule signals must be confirmed within the last 24 hours...
    "confirm_count": 3,  # ...on at least 3 readings before the status changes (see docs/SIX_SIGMA_METHODS.md section 2b)
    "outage_hours": 8.0,  # blackout length to plan for
    "conf": 0.95,
    "backup_target": 0.95,  # warn if P(backup carries the outage) falls below this
    "recent_test_days": 90,  # generator p-chart signals in this window count toward status
}

UNIT_COLUMNS = ["unit_id", "unit_type", "backup_generator", "units_stored", "value_per_unit"]
TEMP_COLUMNS = ["timestamp", "unit_id", "temp_c"]
GEN_COLUMNS = ["test_date", "generator_id", "test_type", "started", "run_hours", "run_failure"]


class InputError(ValueError):
    """A problem with the uploaded files that the user can fix."""


def _require(df, cols, name):
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise InputError(f"{name} is missing column(s): {', '.join(missing)}")


def clean_inputs(units, temps, gens):
    """Validate columns and types. Returns cleaned copies; raises InputError with a readable message."""
    _require(units, UNIT_COLUMNS, "units.csv")
    _require(temps, TEMP_COLUMNS, "temperature_log.csv")
    _require(gens, GEN_COLUMNS, "generator_log.csv")
    units = units.copy()
    units["unit_type"] = units["unit_type"].str.strip().str.upper()
    for t in units["unit_type"].unique():
        try:
            get_spec(t)
        except ValueError as e:
            raise InputError(str(e)) from e
    temps = temps.copy()
    temps["timestamp"] = pd.to_datetime(temps["timestamp"], errors="coerce")
    temps["temp_c"] = pd.to_numeric(temps["temp_c"], errors="coerce")
    bad = temps["timestamp"].isna() | temps["temp_c"].isna()
    temps = temps[~bad]
    unknown = set(temps["unit_id"]) - set(units["unit_id"])
    if unknown:
        raise InputError(
            "temperature_log.csv has unit_id(s) not listed in units.csv: " + ", ".join(sorted(unknown))
        )
    gens = gens.copy()
    gens["test_date"] = pd.to_datetime(gens["test_date"], errors="coerce")
    for c in ["started", "run_failure"]:
        gens[c] = pd.to_numeric(gens[c], errors="coerce").fillna(0).astype(int)
    gens["run_hours"] = pd.to_numeric(gens["run_hours"], errors="coerce").fillna(0.0)
    gens = gens[~gens["test_date"].isna()]
    return units, temps, gens, int(bad.sum())


def analyze_unit(readings, unit_type, params=None):
    """Analyze one storage unit's temperature log.

    Parameters
    ----------
    readings : DataFrame with timestamp, temp_c (one unit)
    unit_type : "RBC", "PLASMA" or "PLATELETS"
    params : dict overriding DEFAULTS

    Returns a dict: limits, run-rule hits, excursions, capability, status and the chart series.
    """
    p = {**DEFAULTS, **(params or {})}
    spec = get_spec(unit_type)
    r = readings.sort_values("timestamp").reset_index(drop=True)
    x = r["temp_c"].to_numpy(dtype=float)
    ts = r["timestamp"]
    start, end = ts.iloc[0], ts.iloc[-1]
    base_mask = (ts < start + pd.Timedelta(days=p["baseline_days"])).to_numpy()
    if base_mask.sum() < 10:
        base_mask[: min(10, len(x))] = True
    if len(x) < 10:
        return {"status": "Insufficient data", "reason": "Need at least 10 readings.", "n": len(x)}

    # Phase I: control limits from the baseline.
    lim = spc.imr_limits(x[base_mask])
    base_hits = spc.run_rules(x[base_mask], lim["xbar"], lim["sigma_s"])
    # Stable baseline = no CONFIRMED special-cause signal (same policy as the status; see below).
    baseline_stable = not _confirmed(
        [h["index"] for h in base_hits if h["rule"] in spc.WARNING_RULES], ts, p["confirm_hours"], p["confirm_count"]
    )

    # Phase II: judge every reading against the fixed baseline limits.
    hits = spc.run_rules(x, lim["xbar"], lim["sigma_s"])
    for h in hits:
        h["timestamp"] = ts.iloc[h["index"]].isoformat()
    window_start = end - pd.Timedelta(days=p["window_days"])
    recent = [h for h in hits if ts.iloc[h["index"]] >= window_start and not base_mask[h["index"]]]

    exc_idx = [i for i, v in enumerate(x) if out_of_spec(v, spec["lower"], spec["upper"])]
    recent_exc = [i for i in exc_idx if ts.iloc[i] >= window_start]

    # Early-warning lead time: hours between the first warning-rule signal after the baseline and the
    # first excursion that follows it.
    lead_hours = None
    phase2_warn = [h for h in hits if h["rule"] in spc.WARNING_RULES and not base_mask[h["index"]]]
    if exc_idx and phase2_warn:
        first_exc = exc_idx[0]
        before = [h for h in phase2_warn if h["index"] <= first_exc]
        if before:
            lead_hours = (ts.iloc[first_exc] - ts.iloc[before[0]["index"]]).total_seconds() / 3600

    # Capability on the stable baseline (sigma_short and sigma_total from phase I).
    cap = capability.capability_report(
        lim["xbar"], lim["sigma_s"], lim["sigma_t"], lim["n"], spec["lower"], spec["upper"], p["conf"]
    )
    cap["baseline_stable"] = baseline_stable
    if not baseline_stable:
        # Course rule: capability assumes a stable process. We still show the numbers, flagged, because
        # with ~84 baseline readings a confirmed false alarm happens in roughly 1 healthy unit in 6.
        cap["verdict"] = (
            "caution: the baseline itself shows confirmed run-rule signals, so these indices may overstate "
            "capability; " + cap["verdict"]
        )
    # Actual performance over the recent window (Ppk with sigma_total of the window).
    w = x[(ts >= window_start).to_numpy()]
    recent_ppk = (
        capability.ppk(float(np.mean(w)), float(np.std(w, ddof=1)), spec["lower"], spec["upper"])
        if w.size > 2
        else None
    )

    # Confirmed-signal policy (docs/SIX_SIGMA_METHODS.md section 2b): applying all run rules to every
    # reading raises false alarms on about half of healthy units in a week. A status changes only when
    # at least confirm_count readings in the last confirm_hours carry a signal. Every signal still
    # appears on the chart and in `hits`.
    confirm_start = end - pd.Timedelta(hours=p["confirm_hours"])
    last = [h for h in hits if ts.iloc[h["index"]] > confirm_start and not base_mask[h["index"]]]
    warn_idx = {h["index"] for h in last if h["rule"] in spc.WARNING_RULES}
    review_idx = {h["index"] for h in last if h["rule"] in spc.REVIEW_RULES}
    warn_rules = sorted({h["rule"] for h in last if h["rule"] in spc.WARNING_RULES})
    review_rules = sorted({h["rule"] for h in last if h["rule"] in spc.REVIEW_RULES})
    if recent_exc:
        status = "Critical"
        worst = x[recent_exc[int(np.argmax([abs(x[i] - spec["target"]) for i in recent_exc]))]]
        reason = (
            f"Excursion: {len(recent_exc)} reading(s) outside the {_spec_text(spec)} spec "
            f"in the last {p['window_days']} days (worst {worst:.1f} C)"
        )
    elif len(warn_idx) >= p["confirm_count"]:
        status = "Warning"
        reason = "Unstable (special-cause variation): " + "; ".join(f"Rule {k}: {spc.RULE_TEXT[k]}" for k in warn_rules)
    elif len(review_idx) >= p["confirm_count"]:
        status = "Review"
        reason = "Check how readings are taken: " + "; ".join(f"Rule {k}: {spc.RULE_TEXT[k]}" for k in review_rules)
    else:
        status = "Normal"
        n_iso = len(warn_idx | review_idx)
        reason = "Stable and within spec" + (f" · {n_iso} unconfirmed signal{'s' if n_iso > 1 else ''}" if n_iso else "")

    mr = np.concatenate([[np.nan], spc.moving_range(x)])
    return {
        "unit_type": unit_type,
        "spec": {k: spec[k] for k in ["label", "lower", "upper", "target", "source"]},
        "n": int(len(x)),
        "baseline_n": int(base_mask.sum()),
        "baseline_stable": baseline_stable,
        "limits": lim,
        "hits": hits,
        "recent_hits": recent,
        "confirmed_signal_readings": len(warn_idx),
        "excursions": [{"index": i, "timestamp": ts.iloc[i].isoformat(), "temp_c": float(x[i])} for i in exc_idx],
        "recent_excursions": len(recent_exc),
        "lead_hours": lead_hours,
        "capability": cap,
        "recent_ppk": recent_ppk,
        "status": status,
        "reason": reason,
        "series": {
            "timestamp": [t.isoformat() for t in ts],
            "temp_c": x.tolist(),
            "mr": mr.tolist(),
            "baseline": base_mask.tolist(),
        },
    }


def analyze_generator(log, params=None):
    """Analyze one generator's test and outage log: p chart, start probability, running reliability."""
    p = {**DEFAULTS, **(params or {})}
    g = log.sort_values("test_date").reset_index(drop=True)
    demands = len(g)
    starts = int(g["started"].sum())
    start_failures = demands - starts

    # Rational subgroups: calendar QUARTERS (about 15 start demands each). With ~5 demands a month and
    # pbar near 1%, a single failure would breach a monthly limit, so monthly points false-alarm.
    month = g["test_date"].dt.to_period("Q")
    monthly = g.assign(month=month, fail=1 - g["started"]).groupby("month").agg(
        failures=("fail", "sum"), demands=("fail", "size")
    )
    months = [str(m) for m in monthly.index]
    last_day = g["test_date"].iloc[-1]
    recent_cut = (last_day - pd.Timedelta(days=p["recent_test_days"])).to_period("Q")
    # Phase I for the p chart: pbar from the quarters BEFORE the recent window being judged (if we have
    # at least 4 of them), so a new problem cannot inflate its own control limits.
    base = np.asarray(monthly.index < recent_cut)
    if base.sum() < 4:
        base = np.ones(len(monthly), dtype=bool)
    pc = spc.p_chart(monthly["failures"].to_numpy(), monthly["demands"].to_numpy(), baseline=base)
    recent_signal = [
        months[i] for i, s in enumerate(pc["signal"]) if s and monthly.index[i] >= recent_cut and pc["p"][i] > pc["pbar"]
    ]

    sp = reliability.binomial_start_probability(starts, demands, p["conf"])
    ran = g[g["started"] == 1]
    rel = reliability.generator_reliability(
        int(ran["run_failure"].sum()), float(ran["run_hours"].sum()), p["outage_hours"], p["conf"]
    )
    p_backup = system.backup_power(sp["p_start"], rel["R_t"])
    p_backup_lower = system.backup_power(sp["p_start_lower"], rel["R_t_lower"])

    last = g.iloc[-1]
    recent_tests = g[g["test_date"] >= last_day - pd.Timedelta(days=p["recent_test_days"])]
    if last["started"] == 0:
        status, reason = "Critical", f"Latest recorded start test ({last['test_date'].date()}) failed"
    elif recent_signal:
        status, reason = "Critical", "p chart signal: start-failure fraction above its control limit in quarter " + ", ".join(recent_signal)
    elif p_backup < p["backup_target"]:
        status, reason = (
            "Warning",
            f"P(backup carries a {p['outage_hours']:g} h outage) = {p_backup:.3f}, below the {p['backup_target']} target",
        )
    else:
        status, reason = "Normal", "Starting reliably; no p chart signal"

    return {
        "status": status,
        "reason": reason,
        "demands": demands,
        "start_failures": start_failures,
        "recent_start_failures": int((recent_tests["started"] == 0).sum()),
        "start": sp,
        "running": rel,
        "p_backup": p_backup,
        "p_backup_lower": p_backup_lower,
        "p_loss": 1 - p_backup,
        "p_chart": {"period": months, "failures": monthly["failures"].tolist(), "demands": monthly["demands"].tolist(), **pc},
        "reliability_curve": _curve(sp["p_start"], rel),
        "tests": [
            {
                "test_date": r.test_date.date().isoformat(),
                "test_type": r.test_type,
                "started": int(r.started),
                "run_hours": float(r.run_hours),
                "run_failure": int(r.run_failure),
            }
            for r in g.itertuples()
        ][-12:],
    }


def _confirmed(indices, ts, hours, count):
    """True if at least `count` distinct signalling readings fall within any `hours`-long window."""
    idx = sorted(set(indices))
    for i in range(len(idx) - count + 1):
        if (ts.iloc[idx[i + count - 1]] - ts.iloc[idx[i]]) < pd.Timedelta(hours=hours):
            return True
    return False


def _curve(p_start, rel, hours=72):
    t = np.arange(0, hours + 1, 2, dtype=float)
    return {
        "hours": t.tolist(),
        "R": reliability.R(t, rel["lambda_hat"]).tolist(),
        "R_lower": reliability.R(t, rel["lambda_upper"]).tolist(),
        "backup": (p_start * reliability.R(t, rel["lambda_hat"])).tolist(),
    }


def analyze_dataset(units, temps, gens, params=None):
    """Full report for a site: every unit, every generator, overview tiles and ranked actions."""
    p = {**DEFAULTS, **(params or {})}
    units, temps, gens, dropped = clean_inputs(units, temps, gens)

    unit_reports = []
    for u in units.itertuples():
        rows = temps[temps["unit_id"] == u.unit_id]
        if rows.empty:
            continue
        rep = analyze_unit(rows, u.unit_type, p)
        rep.update(
            unit_id=u.unit_id,
            backup_generator=u.backup_generator,
            units_stored=float(u.units_stored),
            value_per_unit=float(u.value_per_unit),
            inventory_value=float(u.units_stored) * float(u.value_per_unit),
        )
        unit_reports.append(rep)

    gen_reports = []
    for gid, log in gens.groupby("generator_id"):
        rep = analyze_generator(log, p)
        covered = [u for u in unit_reports if u["backup_generator"] == gid]
        value = sum(u["inventory_value"] for u in covered)
        rep.update(
            generator_id=gid,
            units_covered=[u["unit_id"] for u in covered],
            inventory_value=value,
            dollars_at_risk=system.dollars_at_risk(1, value, rep["p_loss"]),
        )
        gen_reports.append(rep)

    window_start = temps["timestamp"].max() - pd.Timedelta(days=p["window_days"])
    overview = {
        "units_monitored": len(unit_reports),
        "active_alerts": sum(r["status"] in ("Warning", "Critical") for r in unit_reports + gen_reports),
        "units_with_excursions": sum(r.get("recent_excursions", 0) > 0 for r in unit_reports),
        "generator_test_failures": sum(r["recent_start_failures"] for r in gen_reports),
        "dollars_at_risk": sum(r["dollars_at_risk"] for r in gen_reports),
        "inventory_value": sum(r["inventory_value"] for r in unit_reports),
        "window_start": window_start.isoformat(),
        "window_end": temps["timestamp"].max().isoformat(),
        "outage_hours": p["outage_hours"],
        "rows_dropped": dropped,
    }
    return _json_safe(
        {
            "overview": overview,
            "units": unit_reports,
            "generators": gen_reports,
            "actions": _actions(unit_reports, gen_reports, p),
            "params": p,
        }
    )


def _actions(units, gens, p):
    """Rank what to do first: Critical before Warning before Review, then by dollars involved."""
    order = {"Critical": 0, "Warning": 1, "Review": 2}
    acts = []
    for u in units:
        if u["status"] not in order:
            continue
        if u["status"] == "Critical":
            text = (
                f"{u['unit_id']}: move inventory to a stable unit, quarantine affected products for "
                f"medical-director review, and call refrigeration service."
            )
        elif u["status"] == "Warning":
            text = f"{u['unit_id']}: schedule service before the next shift; the chart shows special-cause variation."
        else:
            text = f"{u['unit_id']}: check the thermometer and how readings are logged."
        acts.append({"priority": u["status"], "item": u["unit_id"], "action": text, "why": u["reason"], "value": u["inventory_value"]})
    for g in gens:
        if g["status"] not in order:
            continue
        text = (
            f"{g['generator_id']}: repair and re-test before the next storm; "
            f"${g['inventory_value']:,.0f} of blood depends on it."
        )
        acts.append({"priority": g["status"], "item": g["generator_id"], "action": text, "why": g["reason"], "value": g["dollars_at_risk"]})
    acts.sort(key=lambda a: (order[a["priority"]], -a["value"]))
    return acts


def _spec_text(spec):
    if spec["lower"] is None:
        return f"at or below {spec['upper']:g} C"
    return f"{spec['lower']:g}-{spec['upper']:g} C"


def _json_safe(o):
    """Convert numpy types and NaN/inf to plain JSON values."""
    if isinstance(o, dict):
        return {k: _json_safe(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_json_safe(v) for v in o]
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating, float)):
        f = float(o)
        return f if math.isfinite(f) else None
    if isinstance(o, np.bool_):
        return bool(o)
    if isinstance(o, (pd.Timestamp,)):
        return o.isoformat()
    return o
