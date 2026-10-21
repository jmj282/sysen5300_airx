"""API smoke tests: the endpoints return the same numbers as the library."""

from pathlib import Path

import pandas as pd
from fastapi.testclient import TestClient

from app import app

client = TestClient(app)
DATA = Path(__file__).resolve().parents[3] / "data"


def test_root_and_datasets():
    assert client.get("/").status_code == 200
    ds = client.get("/datasets").json()
    assert [d["id"] for d in ds] == ["normal_operation", "temperature_degradation", "generator_failure"]
    assert all(d["available"] for d in ds)


def test_analyze_scenario_matches_library():
    r = client.get("/analyze/temperature_degradation").json()
    st = {u["unit_id"]: u["status"] for u in r["units"]}
    assert st["R-04"] == "Critical" and st["R-07"] == "Warning"


def test_upload_roundtrip_equals_bundled():
    d = DATA / "generator_failure"
    files = {
        "units": ("units.csv", (d / "units.csv").read_bytes(), "text/csv"),
        "temperature_log": ("temperature_log.csv", (d / "temperature_log.csv").read_bytes(), "text/csv"),
        "generator_log": ("generator_log.csv", (d / "generator_log.csv").read_bytes(), "text/csv"),
    }
    up = client.post("/analyze", files=files).json()
    bundled = client.get("/analyze/generator_failure").json()
    assert up["overview"] == bundled["overview"]


def test_upload_bad_csv_is_422():
    files = {k: (f"{k}.csv", b"a,b\n1,2\n", "text/csv") for k in ["units", "temperature_log", "generator_log"]}
    r = client.post("/analyze", files=files)
    assert r.status_code == 422 and "missing column" in r.json()["detail"]


def test_imr_endpoint_known_answer():
    x = pd.read_csv(Path(__file__).parent / "fixtures" / "daily_production.csv")["production"].tolist()
    lim = client.post("/spc/imr", json={"values": x}).json()["limits"]
    assert round(lim["lower"]) == 2118 and round(lim["upper"]) == 3602


def test_generator_endpoint():
    r = client.post("/reliability/generator", json={"starts": 9, "demands": 10, "run_failures": 0, "run_hours": 100, "outage_hours": 8, "inventory_value": 1000}).json()
    assert r["p_start"] == 0.9 and r["R_t"] == 1.0
    assert abs(r["p_loss"] - 0.1) < 1e-9 and abs(r["dollars_at_risk"] - 100) < 1e-6


def test_dataset_cards_and_zip_download():
    import io
    import zipfile

    ds = client.get("/datasets").json()
    assert all(d["title"] and d["planted"] and len(d["files"]) == 3 for d in ds)
    r = client.get("/datasets/generator_failure.zip")
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    names = zipfile.ZipFile(io.BytesIO(r.content)).namelist()
    assert "generator_failure/temperature_log.csv" in names and "generator_failure/CODEBOOK.md" in names
    assert client.get("/datasets/nope.zip").status_code == 404
