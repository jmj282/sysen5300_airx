"""AirX ColdChain QC: REST API.

Thin layer over the bloodbank_qc library. Every statistic lives in bloodbank_qc/ and is tested in
tests/. This file only parses input, calls the library and returns JSON.

Run locally:  ./testme.sh   then open http://localhost:8000/docs
"""

import io
import os
from pathlib import Path
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from bloodbank_qc import capability, reliability, spc, system
from bloodbank_qc.analyze import DEFAULTS, InputError, analyze_dataset
from bloodbank_qc.specs import STORAGE_SPECS

SCENARIOS = {
    "normal_operation": "Normal operation: every unit stable and in spec, both generators healthy",
    "temperature_degradation": "Temperature degradation: R-04 compressor drifting up; R-07 set point shifted",
    "generator_failure": "Generator failure: G-02 failing start tests, including a real blackout",
}

# Plain-language descriptions shown on the dashboard's dataset cards (see data/README.md).
SCENARIO_INFO = {
    "normal_operation": {
        "title": "Normal operation",
        "tagline": "A healthy blood bank: the baseline everything else is judged against.",
        "planted": "Nothing. Every fridge, freezer and incubator holds its set point with ordinary noise; both generators start about 99% of the time.",
        "expect": "0 alerts · every Cpk above 1.33 · small expected loss",
    },
    "temperature_degradation": {
        "title": "Temperature degradation",
        "tagline": "A compressor wears out, and the run rules see it coming.",
        "planted": "R-04 drifts up about 0.27 °C a day from Oct 8 and leaves the 1–6 °C spec on Oct 14. R-07's thermostat jumps 0.6 °C on Oct 15 but stays in spec.",
        "expect": "R-04 Critical, flagged 5 days early · R-07 Warning while still in spec",
    },
    "generator_failure": {
        "title": "Generator failure",
        "tagline": "A backup generator stops starting, right before the storm season.",
        "planted": "G-02's starter fails 8 times in 90 days, including the Oct 6 blackout and the latest weekly test, plus 2 failures while running.",
        "expect": "G-02 Critical · p chart signals · ~19% chance of losing cooling in an 8 h blackout",
    },
}
FILES = ("units.csv", "temperature_log.csv", "generator_log.csv")


def _data_dir():
    """Bundled scenarios: $AIRX_DATA_DIR, else the repo's data/ folder, else ./data (deployed bundle)."""
    env = os.environ.get("AIRX_DATA_DIR")
    candidates = [Path(env)] if env else []
    here = Path(__file__).resolve().parent
    candidates += [here.parents[1] / "data", here / "data"]
    for c in candidates:
        if (c / "normal_operation").is_dir():
            return c
    return candidates[-1]


DATA_DIR = _data_dir()

app = FastAPI(
    title="AirX ColdChain QC API",
    description=(
        "Six Sigma statistics for blood bank cold-chain integrity (SYSEN 5300 Six Sigma Hackathon, team AirX). "
        "I-MR control charts and run rules for refrigeration units, capability indices against blood "
        "storage specs, p charts and exponential reliability for backup generators, and system reliability "
        "for blackouts. Try GET /analyze/temperature_degradation."
    ),
    version="1.0.0",
)

# Wide-open CORS so the React dashboard (another origin) can call the API. Fine for a hackathon demo.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/")
async def root():
    """Health check and pointers."""
    return {"message": "AirX ColdChain QC API is running", "docs": "/docs", "scenarios": list(SCENARIOS)}


@app.get("/__docs__/", include_in_schema=False)
async def docs_redirect():
    return RedirectResponse(url="/docs")


@app.get("/specs")
async def specs():
    """Storage specification limits used for each product type (regulatory, not from data)."""
    return STORAGE_SPECS


@app.get("/datasets")
async def datasets():
    """The bundled test scenarios, with descriptions and file sizes."""
    out = []
    for k, v in SCENARIOS.items():
        d = DATA_DIR / k
        files = [{"name": f, "rows": _rows(d / f), "bytes": (d / f).stat().st_size} for f in FILES if (d / f).exists()]
        out.append({"id": k, "description": v, **SCENARIO_INFO[k], "available": d.is_dir(), "files": files})
    return out


def _rows(path):
    with open(path, "rb") as fh:
        return max(sum(1 for _ in fh) - 1, 0)


@app.get("/datasets/{scenario}.zip")
async def dataset_zip(scenario: str):
    """Download all three CSVs of one scenario, plus the codebook, as a single zip file."""
    import zipfile

    from fastapi.responses import Response

    if scenario not in SCENARIOS:
        raise HTTPException(404, "Unknown scenario")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for f in FILES:
            z.write(DATA_DIR / scenario / f, f"{scenario}/{f}")
        codebook = DATA_DIR / "README.md"
        if codebook.exists():
            z.write(codebook, f"{scenario}/CODEBOOK.md")
    return Response(
        buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="airx_{scenario}.zip"'},
    )


@app.get("/datasets/{scenario}/{filename}")
async def dataset_file(scenario: str, filename: str):
    """Download one bundled CSV (so users can see the exact input format)."""
    if scenario not in SCENARIOS or filename not in ("units.csv", "temperature_log.csv", "generator_log.csv"):
        raise HTTPException(404, "Unknown scenario or file")
    from fastapi.responses import FileResponse

    return FileResponse(DATA_DIR / scenario / filename, media_type="text/csv", filename=f"{scenario}_{filename}")


def _params(baseline_days, window_days, outage_hours, confirm_count):
    return {
        "baseline_days": baseline_days,
        "window_days": window_days,
        "outage_hours": outage_hours,
        "confirm_count": confirm_count,
    }


@app.get("/analyze/{scenario}")
async def analyze_scenario(
    scenario: str,
    baseline_days: int = DEFAULTS["baseline_days"],
    window_days: int = DEFAULTS["window_days"],
    outage_hours: float = DEFAULTS["outage_hours"],
    confirm_count: int = DEFAULTS["confirm_count"],
):
    """Full analysis of one bundled scenario: every unit, every generator, overview tiles, ranked actions."""
    if scenario not in SCENARIOS:
        raise HTTPException(404, f"Unknown scenario. Use one of: {', '.join(SCENARIOS)}")
    d = DATA_DIR / scenario
    try:
        return analyze_dataset(
            pd.read_csv(d / "units.csv"),
            pd.read_csv(d / "temperature_log.csv"),
            pd.read_csv(d / "generator_log.csv"),
            _params(baseline_days, window_days, outage_hours, confirm_count),
        )
    except FileNotFoundError:
        raise HTTPException(500, f"Scenario files not found in {d}. Run python data/make_datasets.py")


@app.post("/analyze")
async def analyze_upload(
    units: UploadFile = File(..., description="units.csv"),
    temperature_log: UploadFile = File(..., description="temperature_log.csv"),
    generator_log: UploadFile = File(..., description="generator_log.csv"),
    baseline_days: int = DEFAULTS["baseline_days"],
    window_days: int = DEFAULTS["window_days"],
    outage_hours: float = DEFAULTS["outage_hours"],
    confirm_count: int = DEFAULTS["confirm_count"],
):
    """Analyze your own three CSV logs (same columns as the bundled scenarios; see data/README.md)."""
    try:
        frames = [pd.read_csv(io.BytesIO(await f.read())) for f in (units, temperature_log, generator_log)]
        return analyze_dataset(*frames, _params(baseline_days, window_days, outage_hours, confirm_count))
    except InputError as e:
        raise HTTPException(422, str(e))
    except (pd.errors.ParserError, pd.errors.EmptyDataError, UnicodeDecodeError) as e:
        raise HTTPException(422, f"Could not read a CSV file: {e}")


# ---------- single-statistic endpoints (useful from /docs and for checking numbers by hand) ----------


class IMRRequest(BaseModel):
    values: List[float] = Field(..., description="Readings in time order", examples=[[4.1, 3.9, 4.0, 4.2, 4.4, 4.1, 3.8, 4.0, 4.3, 4.6]])
    baseline_n: Optional[int] = Field(None, description="How many leading readings form the baseline (default: all)")


@app.post("/spc/imr")
async def imr(req: IMRRequest):
    """I-MR control limits from the baseline, and every run-rule signal across all values."""
    if len(req.values) < 2:
        raise HTTPException(422, "Need at least 2 values")
    base = req.values[: req.baseline_n] if req.baseline_n else req.values
    lim = spc.imr_limits(base)
    return {"limits": lim, "hits": spc.run_rules(req.values, lim["xbar"], lim["sigma_s"])}


class CapabilityRequest(BaseModel):
    values: List[float] = Field(..., examples=[[4.1, 3.9, 4.0, 4.2, 4.4, 4.1, 3.8, 4.0, 4.3, 4.6]])
    lower: Optional[float] = Field(1.0, description="E_lower spec limit (None for one-sided)")
    upper: Optional[float] = Field(6.0, description="E_upper spec limit (None for one-sided)")


@app.post("/capability")
async def capability_endpoint(req: CapabilityRequest):
    """Cp, Cpk, Pp, Ppk with 95% confidence intervals (sigma_short from the moving range)."""
    if len(req.values) < 3:
        raise HTTPException(422, "Need at least 3 values")
    lim = spc.imr_limits(req.values)
    return capability.capability_report(lim["xbar"], lim["sigma_s"], lim["sigma_t"], lim["n"], req.lower, req.upper)


class GeneratorRequest(BaseModel):
    starts: int = Field(..., description="Successful starts", examples=[195])
    demands: int = Field(..., description="Start attempts (tests + real outages)", examples=[204])
    run_failures: int = Field(..., description="Failures while running", examples=[2])
    run_hours: float = Field(..., description="Total hours run", examples=[99.0])
    outage_hours: float = Field(8.0, description="Blackout length to plan for")
    inventory_value: float = Field(0.0, description="Dollar value of blood this generator protects")


@app.post("/reliability/generator")
async def generator(req: GeneratorRequest):
    """Start probability, failure rate, R(t), MTTF and P(loss of cooling) for one generator."""
    try:
        sp = reliability.binomial_start_probability(req.starts, req.demands)
        rel = reliability.generator_reliability(req.run_failures, req.run_hours, req.outage_hours)
    except ValueError as e:
        raise HTTPException(422, str(e))
    p_loss = system.loss_of_cooling(sp["p_start"], rel["R_t"])
    return {**sp, **rel, "p_loss": p_loss, "dollars_at_risk": system.dollars_at_risk(1, req.inventory_value, p_loss)}
