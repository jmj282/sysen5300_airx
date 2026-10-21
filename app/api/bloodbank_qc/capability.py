"""Process capability (Cp, Cpk) and process performance (Pp, Ppk) indices.

Course: "Indices and Confidence Intervals for Statistical Process Control in Python"
https://timothyfraser.com/sigma/chapters/indices-and-confidence-intervals-for-statistical-process-control-in-python.html

- Capability indices (Cp, Cpk) use sigma_short: what the unit could do if it stays stable.
- Performance indices (Pp, Ppk) use sigma_total: what it actually did.
- Capability is only meaningful once the control chart says the process is stable.
- Benchmark: 1.0 means the spec width exactly fits +/- 3 sigma; 1.33 is a common "good" target.

Spec limits use the course notation E_lower / E_upper. Function signatures mirror the course helpers
cp(sigma_s, upper, lower), pp(sigma_t, upper, lower), cpk(mu, sigma_s, lower, upper),
ppk(mu, sigma_t, lower, upper).
"""

import math

from scipy.stats import norm


def _valid_sigma(sigma):
    return sigma is not None and math.isfinite(sigma) and sigma > 0


def cp(sigma_s, upper, lower):
    """Cp = |E_upper - E_lower| / (6 sigma_short). None if undefined (one-sided spec or sigma 0)."""
    if upper is None or lower is None or not _valid_sigma(sigma_s):
        return None
    return abs(upper - lower) / (6 * sigma_s)


def pp(sigma_t, upper, lower):
    """Pp = |E_upper - E_lower| / (6 sigma_total). None if undefined."""
    if upper is None or lower is None or not _valid_sigma(sigma_t):
        return None
    return abs(upper - lower) / (6 * sigma_t)


def cpk(mu, sigma_s, lower=None, upper=None):
    """Cpk = min(|mu - E_lower|, |E_upper - mu|) / (3 sigma_short).

    One-sided if only one limit is given (e.g. plasma: upper = -18 C only).
    Returns a negative value if the mean sits outside the spec (still meaningful: badly incapable).
    """
    if not _valid_sigma(sigma_s) or (lower is None and upper is None):
        return None
    sides = []
    if lower is not None:
        sides.append((mu - lower) / (3 * sigma_s))
    if upper is not None:
        sides.append((upper - mu) / (3 * sigma_s))
    return min(sides)


def ppk(mu, sigma_t, lower=None, upper=None):
    """Ppk: Cpk computed with sigma_total. One-sided if only one limit is given."""
    return cpk(mu, sigma_t, lower=lower, upper=upper)


def index_ci(estimate, v, n, kind="centered", conf=0.95):
    """Normal-approximation confidence interval for a capability or performance index.

    Course (06 recitation, theoretical CI):
      centred index (Cp, Pp):  SE = est * sqrt(1 / (2v))
      k index (Cpk, Ppk):      SE = est * sqrt(1 / (2v) + 1 / (9 n est^2))
      CI = est +/- z * SE

    Parameters
    ----------
    estimate : float or None
    v : degrees of freedom. For an I-MR chart we use v = n - 1 (the course's v_short = k(n_w - 1)
        is undefined at n_w = 1), and say so in the docs.
    n : number of observations.
    kind : "centered" or "k".
    conf : confidence level (two-sided).

    Returns (lower, upper) or (None, None).
    """
    if estimate is None or v is None or v <= 0 or n is None or n <= 0:
        return (None, None)
    z = norm.ppf(1 - (1 - conf) / 2)
    if kind == "centered":
        se = estimate * math.sqrt(1 / (2 * v))
    elif kind == "k":
        if estimate == 0:
            return (None, None)
        se = abs(estimate) * math.sqrt(1 / (2 * v) + 1 / (9 * n * estimate**2))
    else:
        raise ValueError("kind must be 'centered' or 'k'.")
    return (estimate - z * abs(se), estimate + z * abs(se))


def capability_report(mu, sigma_s, sigma_t, n, lower=None, upper=None, conf=0.95):
    """All four indices with confidence intervals, for one storage unit.

    Returns a dict {cp, cpk, pp, ppk, each with estimate/lower/upper} and a verdict string.
    The verdict reads Cpk's interval: entirely above 1.33 "capable", entirely below 1.0 "not
    capable", otherwise "inconclusive: keep logging".
    """
    v = n - 1
    out = {}
    for name, est, kind in [
        ("cp", cp(sigma_s, upper, lower), "centered"),
        ("pp", pp(sigma_t, upper, lower), "centered"),
        ("cpk", cpk(mu, sigma_s, lower, upper), "k"),
        ("ppk", ppk(mu, sigma_t, lower, upper), "k"),
    ]:
        lo, hi = index_ci(est, v, n, kind=kind, conf=conf)
        out[name] = {"estimate": est, "lower": lo, "upper": hi}
    c = out["cpk"]
    if c["estimate"] is None:
        verdict = "undefined (no variation, or no spec limit)"
    elif c["lower"] is not None and c["lower"] >= 1.33:
        verdict = "capable (Cpk confidence interval above 1.33)"
    elif c["upper"] is not None and c["upper"] < 1.0:
        verdict = "not capable (Cpk confidence interval below 1.0)"
    else:
        verdict = "inconclusive: interval overlaps 1.0-1.33, keep logging"
    out["verdict"] = verdict
    return out
