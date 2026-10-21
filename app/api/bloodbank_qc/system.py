"""System reliability: will the blood stay cold through a blackout?

Course: "System Reliability in Python" (SYSEN 5300, Fraser)
https://timothyfraser.com/sigma/chapters/system-reliability-in-python.html

Block diagram (solve inside out, as the course teaches):

    grid power ----------------------------------------\
                                                         >-- fridge powered
    generator starts (p_start) --> generator runs t hours (R(t)) --/

- The backup branch is a SERIES system: R_backup(t) = p_start * R(t).
- During a blackout the grid branch is down, so the fridge depends only on the backup branch:
  P(loss of cooling during a t-hour outage) = 1 - R_backup(t).
- Grid and backup together form a PARALLEL system: R_system = 1 - (1 - R_grid)(1 - R_backup).

Independence caveat (course question P24, "generator or shore power"): a storm that knocks out the
grid can also flood or disable the generator. That common cause breaks the independence the parallel
formula assumes, so R_system is optimistic in severe weather.
"""

import numpy as np


def series(*reliabilities):
    """Series system: every block must work. R_S = product of R_i."""
    r = np.asarray(reliabilities, dtype=float)
    _check(r)
    return float(np.prod(r))


def parallel(*reliabilities):
    """Parallel (redundant) system: at least one block must work. R_P = 1 - product of (1 - R_i)."""
    r = np.asarray(reliabilities, dtype=float)
    _check(r)
    return float(1 - np.prod(1 - r))


def backup_power(p_start, r_run):
    """Probability the backup branch keeps the fridge powered: p_start * R(t) (series)."""
    return series(p_start, r_run)


def loss_of_cooling(p_start, r_run):
    """Probability the fridge loses power during an outage: 1 - p_start * R(t)."""
    return 1 - backup_power(p_start, r_run)


def dollars_at_risk(units_in_storage, value_per_unit, p_loss):
    """Expected cost of poor quality for one outage: units * value * P(loss of cooling)."""
    if units_in_storage < 0 or value_per_unit < 0:
        raise ValueError("units and value must be non-negative.")
    if not 0 <= p_loss <= 1:
        raise ValueError("p_loss must be a probability between 0 and 1.")
    return units_in_storage * value_per_unit * p_loss


def _check(r):
    if r.size == 0:
        raise ValueError("Give at least one reliability.")
    if np.any((r < 0) | (r > 1)):
        raise ValueError("Reliabilities must be probabilities between 0 and 1.")
