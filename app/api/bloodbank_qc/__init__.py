"""bloodbank_qc: Six Sigma statistics for blood bank cold-chain integrity (AirX ColdChain QC).

Modules
-------
specs        storage specification limits (regulatory, not from data)
spc          I-MR control chart, the 8 run rules, p chart
capability   Cp, Cpk, Pp, Ppk and their confidence intervals
reliability  exponential F, R, f, z, H, AFR, lambda-hat, bounds, MTTF
system       series/parallel system reliability, loss of cooling, dollars at risk
analyze      ties it together for the three CSV logs

Every formula follows SYSEN 5300 (Dr. Timothy Fraser, Cornell); see docs/SIX_SIGMA_METHODS.md.
"""

from . import analyze, capability, reliability, spc, specs, system  # noqa: F401

__version__ = "1.0.0"
