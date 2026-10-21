"""Exponential reliability for backup generators.

Course: "Useful Life Distributions: Exponential" and "Statistical Techniques for Exponential
Distributions" (SYSEN 5300, Fraser).

Course notation (the course writes z(t) for the hazard rate, not h(t)):
  F(t)  failure function (CDF)            = 1 - exp(-lambda t)
  R(t)  reliability                       = exp(-lambda t)
  f(t)  change in failure function (PDF)  = lambda exp(-lambda t)
  z(t)  failure rate (hazard rate)        = f(t) / R(t) = lambda   (constant for the exponential)
  H(t)  accumulative hazard               = lambda t
  AFR   average failure rate              = (H(t2) - H(t1)) / (t2 - t1)
  MTTF  mean time to fail                 = 1 / lambda

`lambda` is reserved in Python, so the parameter is `lambda_` (as in the course's functions_reliability.py).

Assumption: constant hazard (the flat bottom of the bathtub curve), and a repaired generator is as good
as new. Under that assumption MTBF (the industry word for repairable equipment) equals MTTF = 1/lambda.
The course uses MTTF throughout; MTBF is our extension.
"""

import math

import numpy as np
from scipy.stats import chi2


def F(t, lambda_):
    """Failure function: probability of failing by time t."""
    return 1 - np.exp(-lambda_ * np.asarray(t, dtype=float))


def R(t, lambda_):
    """Reliability: probability of still running at time t."""
    return np.exp(-lambda_ * np.asarray(t, dtype=float))


def f(t, lambda_):
    """Change in failure function (density) at time t. Not the failure rate; that is z(t)."""
    return lambda_ * np.exp(-lambda_ * np.asarray(t, dtype=float))


def z(t, lambda_):
    """Failure rate (hazard rate) z(t) = f(t) / R(t). Constant = lambda for the exponential."""
    t = np.asarray(t, dtype=float)
    return f(t, lambda_) / R(t, lambda_)


def H(t, lambda_):
    """Accumulative hazard H(t) = -ln R(t) = lambda t."""
    return lambda_ * np.asarray(t, dtype=float)


def afr(t1, t2, lambda_):
    """Average failure rate between t1 and t2."""
    return (H(t2, lambda_) - H(t1, lambda_)) / (t2 - t1)


def lambda_hat(failures, total_time):
    """Point estimate of the failure rate: lambda-hat = r / T.

    r = number of failures, T = total operating time of all units (failed and still running, i.e.
    time-censored data are counted through their censoring time).
    """
    if total_time <= 0:
        raise ValueError("total_time must be positive.")
    if failures < 0:
        raise ValueError("failures cannot be negative.")
    return failures / total_time


def lambda_upper(failures, total_time, conf=0.95):
    """One-sided upper confidence bound on lambda for time-censored data (course k-factor method).

    lambda_upper = qchisq(conf, 2(r + 1)) / (2T). With zero failures this equals -ln(1 - conf) / T,
    which is the course's special case for "no failures yet" (functions_k.R).
    """
    if total_time <= 0:
        raise ValueError("total_time must be positive.")
    return float(chi2.ppf(conf, 2 * (failures + 1)) / (2 * total_time))


def lambda_lower(failures, total_time, conf=0.95):
    """One-sided lower confidence bound on lambda: qchisq(1 - conf, 2r) / (2T); 0 if r = 0."""
    if failures == 0:
        return 0.0
    return float(chi2.ppf(1 - conf, 2 * failures) / (2 * total_time))


def mttf(lambda_):
    """Mean time to fail, m = 1 / lambda. None if lambda is 0 (no failures observed: unbounded)."""
    if lambda_ is None or lambda_ <= 0:
        return None
    return 1 / lambda_


def generator_reliability(failures, run_hours, outage_hours=8.0, conf=0.95):
    """Summarise a generator's running reliability from its test and outage log.

    Parameters
    ----------
    failures : int   number of times it stopped or failed while running (not failures to start)
    run_hours : float   total hours it ran across all tests and outages
    outage_hours : float   blackout length to evaluate R(t) at
    conf : float   confidence level for the bounds

    Returns
    -------
    dict with lambda_hat, lambda_upper, mttf, mttf_lower (= 1 / lambda_upper), R_t and R_t_lower at
    outage_hours, plus the inputs.
    """
    lam = lambda_hat(failures, run_hours)
    lam_u = lambda_upper(failures, run_hours, conf)
    return {
        "failures": int(failures),
        "run_hours": float(run_hours),
        "outage_hours": float(outage_hours),
        "lambda_hat": lam,
        "lambda_upper": lam_u,
        "mttf": mttf(lam),
        "mttf_lower": mttf(lam_u),
        "R_t": float(R(outage_hours, lam)),
        "R_t_lower": float(R(outage_hours, lam_u)),
        "conf": conf,
    }


def binomial_start_probability(starts, demands, conf=0.95):
    """Probability a generator starts on demand, with a one-sided lower confidence bound.

    p_start = successful starts / demands. The lower bound is the exact (Clopper-Pearson) binomial
    bound: Beta(1 - conf; s, n - s + 1). This is general statistics, beyond the course's p chart.
    """
    from scipy.stats import beta

    if demands <= 0:
        raise ValueError("demands must be positive.")
    if starts < 0 or starts > demands:
        raise ValueError("starts must be between 0 and demands.")
    p = starts / demands
    lower = 0.0 if starts == 0 else float(beta.ppf(1 - conf, starts, demands - starts + 1))
    return {"p_start": p, "p_start_lower": lower, "starts": int(starts), "demands": int(demands)}


def _finite_or_none(x):
    return None if x is None or (isinstance(x, float) and not math.isfinite(x)) else x
