"""Storage specification limits for blood products.

These are the **specification limits** (course notation: E_lower / E_upper). They come from the
regulator and the product, never from the data. Control limits come from the process itself; see
spc.py. Mixing the two up is the most common SPC mistake, so they live in separate modules.

Sources (outside the SYSEN 5300 course; cite in the README):
- Red blood cells 1-6 C: 21 CFR 640.11(a); AABB Standards for Blood Banks and Transfusion Services.
- Plasma frozen at -18 C or colder: 21 CFR 640.34; AABB Standards.
- Platelets 20-24 C: 21 CFR 640.25(a); AABB Standards.
"""

STORAGE_SPECS = {
    "RBC": {
        "label": "Red blood cells (refrigerator)",
        "lower": 1.0,
        "upper": 6.0,
        "target": 4.0,
        "source": "21 CFR 640.11; AABB Standards",
    },
    "PLASMA": {
        "label": "Frozen plasma (freezer)",
        "lower": None,  # one-sided: colder is always fine
        "upper": -18.0,
        "target": -25.0,
        "source": "21 CFR 640.34; AABB Standards",
    },
    "PLATELETS": {
        "label": "Platelets (incubator / agitator)",
        "lower": 20.0,
        "upper": 24.0,
        "target": 22.0,
        "source": "21 CFR 640.25; AABB Standards",
    },
}


def get_spec(unit_type):
    """Return the spec dict for a unit type ("RBC", "PLASMA" or "PLATELETS")."""
    key = str(unit_type).strip().upper()
    if key not in STORAGE_SPECS:
        raise ValueError(
            f"Unknown unit_type '{unit_type}'. Use one of: {', '.join(STORAGE_SPECS)}"
        )
    return STORAGE_SPECS[key]


def out_of_spec(value, lower, upper):
    """True if a reading breaks a specification limit (an excursion)."""
    if lower is not None and value < lower:
        return True
    if upper is not None and value > upper:
        return True
    return False
