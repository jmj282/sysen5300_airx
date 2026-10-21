"""Statistical process control (SPC) for refrigeration units and generator start tests.

Course: SYSEN 5300 (Fraser), chapter "Statistical Process Control in Python".
Lesson 5 slides (I chart, MR chart, the 8 visual tests, p chart).

Control limits answer "is the process STABLE?" They come from the process's own baseline data.
Specification limits (specs.py) answer "is it CAPABLE?" and come from the regulator.
"""

import numpy as np

# Control chart constants for subgroups of size n = 2 (consecutive readings in a moving range).
# Hard-coded textbook values, not simulated with the course's dn(), which is random.
D2_N2 = 1.128  # d2: mean range of two standard-normal draws
D4_N2 = 3.267  # D4 = 1 + 3 * d3 / d2 for n = 2
I_FACTOR = 3 / D2_N2  # = 2.66: individuals-chart limits are xbar +/- 2.66 * mRbar


def moving_range(x):
    """Moving ranges mR_t = |x_t - x_(t-1)|. Returns an array one shorter than x."""
    x = np.asarray(x, dtype=float)
    return np.abs(np.diff(x))


def imr_limits(x_baseline):
    """Individuals and Moving Range (I-MR) chart limits from a stable baseline period.

    Use for one reading at a time (subgroup size 1), e.g. a fridge thermometer logged every 4 hours.

    Parameters
    ----------
    x_baseline : array-like of float
        Readings from a period believed to be stable (phase I). At least 2 values.

    Returns
    -------
    dict with
        n         number of baseline readings
        xbar      centre line (mean of the baseline)
        mrbar     average moving range
        sigma_s   sigma_short = mRbar / d2 (within-time, mostly common-cause variation)
        sigma_t   sigma_total = sample standard deviation of the baseline
        upper     upper control limit of the I chart = xbar + 3 * sigma_s  (= xbar + 2.66 mRbar)
        lower     lower control limit of the I chart = xbar - 3 * sigma_s
        mr_upper  upper control limit of the MR chart = D4 * mRbar = 3.267 * mRbar
        mr_lower  0

    Notes
    -----
    Fraser's helper limits_mr() uses mRbar + 3 * mRbar / d2 (about 3.66 mRbar) for the MR chart; his
    slides and the 9/24 lecture use D4 * mRbar = 3.267 mRbar. We follow the slides and textbook.
    """
    x = np.asarray(x_baseline, dtype=float)
    x = x[~np.isnan(x)]
    if x.size < 2:
        raise ValueError("I-MR limits need at least 2 baseline readings.")
    mr = moving_range(x)
    xbar = float(np.mean(x))
    mrbar = float(np.mean(mr))
    sigma_s = mrbar / D2_N2
    sigma_t = float(np.std(x, ddof=1))
    return {
        "n": int(x.size),
        "xbar": xbar,
        "mrbar": mrbar,
        "sigma_s": sigma_s,
        "sigma_t": sigma_t,
        "upper": xbar + 3 * sigma_s,
        "lower": xbar - 3 * sigma_s,
        "mr_upper": D4_N2 * mrbar,
        "mr_lower": 0.0,
    }


RULE_TEXT = {
    1: "One point beyond zone A (outside the control limits)",
    2: "Two out of three points in a row beyond zone B (same side)",
    3: "Four out of five points in a row beyond zone C (same side)",
    4: "Eight points in a row on the same side of the centre line",
    5: "Six points in a row steadily increasing or decreasing",
    6: "Fifteen points in a row in zone C (above and below the centre line)",
    7: "Eight points in a row on both sides of the centre line with none in zone C",
    8: "Fourteen points in a row alternating up and down",
}

# Rules 1-5 point at a shift, trend or jump: an early warning. Rules 6-8 point at the way the data are
# collected (stuck sensor, mixed thermometers, over-correcting thermostat): a review item.
WARNING_RULES = {1, 2, 3, 4, 5}
REVIEW_RULES = {6, 7, 8}


def run_rules(x, center, sigma_s):
    """Apply the course's 8 visual tests for special-cause variation (Lesson 5, slide 60).

    Zones are measured in sigma_short from the centre line: zone C is within 1 sigma, zone B is 1-2,
    zone A is 2-3. A rule "fires" at the index of the last point of the pattern.

    Parameters
    ----------
    x : array-like of float
        Readings in time order (phase II: judged against fixed baseline limits).
    center : float
        Centre line (xbar from imr_limits).
    sigma_s : float
        sigma_short from imr_limits.

    Returns
    -------
    list of dict {rule, index, description}, sorted by index then rule. Empty if sigma_s is 0
    (constant data has no zones, so no special-cause pattern can be judged).
    """
    x = np.asarray(x, dtype=float)
    if sigma_s is None or not np.isfinite(sigma_s) or sigma_s <= 0:
        return []
    z = (x - center) / sigma_s
    n = z.size
    hits = []

    def add(rule, i):
        hits.append({"rule": rule, "index": int(i), "description": RULE_TEXT[rule]})

    d = np.diff(x)
    for i in range(n):
        # Rule 1: one point beyond 3 sigma.
        if abs(z[i]) > 3:
            add(1, i)
        # Rule 2: 2 of 3 beyond 2 sigma, same side (the current point must be one of them).
        if i >= 2:
            w = z[i - 2 : i + 1]
            if (z[i] > 2 and np.sum(w > 2) >= 2) or (z[i] < -2 and np.sum(w < -2) >= 2):
                add(2, i)
        # Rule 3: 4 of 5 beyond 1 sigma, same side (the current point must be one of them).
        if i >= 4:
            w = z[i - 4 : i + 1]
            if (z[i] > 1 and np.sum(w > 1) >= 4) or (z[i] < -1 and np.sum(w < -1) >= 4):
                add(3, i)
        # Rule 4: 8 in a row on the same side of the centre line.
        if i >= 7:
            w = z[i - 7 : i + 1]
            if np.all(w > 0) or np.all(w < 0):
                add(4, i)
        # Rule 5: 6 points in a row steadily increasing or decreasing (5 consecutive same-sign steps).
        if i >= 5:
            s = d[i - 5 : i]
            if np.all(s > 0) or np.all(s < 0):
                add(5, i)
        # Rule 6: 15 in a row inside zone C.
        if i >= 14:
            if np.all(np.abs(z[i - 14 : i + 1]) < 1):
                add(6, i)
        # Rule 7: 8 in a row outside zone C (either side).
        if i >= 7:
            if np.all(np.abs(z[i - 7 : i + 1]) > 1):
                add(7, i)
        # Rule 8: 14 in a row alternating up and down (13 steps alternating in sign).
        if i >= 13:
            s = np.sign(d[i - 13 : i])
            if np.all(s != 0) and np.all(s[1:] == -s[:-1]):
                add(8, i)
    hits.sort(key=lambda h: (h["index"], h["rule"]))
    return hits


def p_chart(failures, demands, baseline=None, method="auto"):
    """p chart (fraction defective) for generator start tests, one point per period.

    p_i = failures_i / demands_i, pbar = sum(failures) / sum(demands) over the BASELINE periods,
    limits = pbar +/- 3 * sqrt(pbar * (1 - pbar) / n_i), computed per period and clipped to [0, 1].
    (Course: ggp() in functions_process_control.py; Lesson 5 slide 45.)

    Parameters
    ----------
    failures, demands : array-like of int, same length. demands must be > 0.
    method : "normal" (the course's pbar +/- 3 sigma), "exact" (binomial probability limits with the
        same 0.135% tail per side as 3 sigma), or "auto" (exact when n * pbar < 5, where the normal
        approximation behind 3-sigma limits breaks down; the course's decision tree says to change
        charts when the binomial assumptions fail).
    baseline : optional array-like of bool, same length. Periods used to estimate pbar (phase I).
        Default: all periods. Use the history before the period you are judging, so a new problem
        cannot inflate its own limits.

    Returns
    -------
    dict with pbar and per-period lists p, upper, lower, signal (True if p_i is outside its limits),
    plus small_n (True if n * pbar < 5 for the typical period, when the normal approximation is weak).
    """
    f = np.asarray(failures, dtype=float)
    n = np.asarray(demands, dtype=float)
    if f.shape != n.shape:
        raise ValueError("failures and demands must be the same length.")
    if f.size == 0:
        raise ValueError("p chart needs at least one period.")
    if np.any(n <= 0):
        raise ValueError("Every period needs at least one demand (test or outage).")
    if np.any(f > n) or np.any(f < 0):
        raise ValueError("failures must be between 0 and demands.")
    b = np.ones(f.shape, dtype=bool) if baseline is None else np.asarray(baseline, dtype=bool)
    if b.shape != f.shape or not b.any():
        raise ValueError("baseline must be the same length as failures and include at least one period.")
    pbar = float(f[b].sum() / n[b].sum())
    p = f / n
    small_n = bool(np.median(n) * pbar < 5)
    use_exact = method == "exact" or (method == "auto" and small_n)
    if use_exact:
        from scipy.stats import binom

        tail = 0.00135  # one-sided tail of a 3-sigma limit
        # Upper limit = largest count still "expected" (P(X > k) <= tail); a point signals above it.
        upper = np.array([binom.ppf(1 - tail, int(ni), pbar) / ni for ni in n])
        lower = np.array([max(binom.ppf(tail, int(ni), pbar) - 1, 0) / ni for ni in n])
    else:
        se = np.sqrt(pbar * (1 - pbar) / n)
        upper = np.minimum(1.0, pbar + 3 * se)
        lower = np.maximum(0.0, pbar - 3 * se)
    signal = (p > upper + 1e-12) | (p < lower - 1e-12)
    return {
        "method": "exact binomial" if use_exact else "normal (3 sigma)",
        "pbar": pbar,
        "p": p.tolist(),
        "upper": upper.tolist(),
        "lower": lower.tolist(),
        "signal": signal.tolist(),
        "baseline": b.tolist(),
        "small_n": small_n,
    }
