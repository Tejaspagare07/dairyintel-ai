"""
Shared feature engineering + standards-based rules.

Used by BOTH train.py (training) and main.py (serving) so the model always sees
features built the same way.

Feature approach follows Hyde et al., "Automated prediction of mastitis infection
patterns in dairy herds using machine learning", Sci Rep 10:4289 (2020):
  * Random Forest classifier
  * engineered RATIO features on top of the raw readings
  * missing values imputed instead of crashing
  * cross-validation + a held-out validation set, threshold chosen on CV
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Column handling
# ---------------------------------------------------------------------------
# Raw CSV column  ->  internal name
CSV_TO_INTERNAL = {
    "Shift": "shift",
    "Fat_%": "fat",
    "SNF_%": "snf",
    "CLR_Density": "clr",
    "Protein_%": "protein",
    "Lactose_%": "lactose",
    "Added_Water_%": "added_water",
    "Milk_Temp_C": "temp",
    # optional lab readings - not in the current CSV, but accepted if a future
    # dataset has them (the pipeline will then learn from them automatically)
    "EC_mS_cm": "ec",
    "SCC_cells_ml": "scc",
}

# Columns the brief says must be removed before training
DROP_ANALYZER = ["Analyzer_Model"]
DROP_LAST_THREE = ["Data_Source", "Original_Test_Date", "Health_Quality_Alert"]
# identifiers - never features
DROP_IDS = ["Test_No", "Date"]

RAW_NUMERIC = ["fat", "snf", "clr", "protein", "lactose", "added_water", "temp"]
OPTIONAL_LAB = ["ec", "scc"]

# Final model inputs (raw + engineered). EC/SCC are only used as model features
# when the training data actually contains them (see train.py).
ENGINEERED = ["fat_protein_ratio", "lactose_snf_ratio", "protein_snf_ratio", "shift_morning", "temp_missing"]
MODEL_FEATURES = RAW_NUMERIC + ENGINEERED


def _num(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, str) and v.strip() == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else f


def _ratio(a, b):
    a, b = _num(a), _num(b)
    if a is None or b is None or b == 0:
        return np.nan
    return a / b


def build_features(rows: List[Dict[str, Any]]) -> pd.DataFrame:
    """rows: list of dicts with internal names (fat, snf, ... , shift). Missing -> NaN."""
    out = []
    for r in rows:
        d = {k: (_num(r.get(k)) if _num(r.get(k)) is not None else np.nan) for k in RAW_NUMERIC + OPTIONAL_LAB}
        d["fat_protein_ratio"] = _ratio(r.get("fat"), r.get("protein"))
        d["lactose_snf_ratio"] = _ratio(r.get("lactose"), r.get("snf"))
        d["protein_snf_ratio"] = _ratio(r.get("protein"), r.get("snf"))
        shift = str(r.get("shift") or "").strip().lower()
        d["shift_morning"] = 1.0 if shift == "morning" else (0.0 if shift == "evening" else np.nan)
        d["temp_missing"] = 1.0 if _num(r.get("temp")) is None else 0.0
        out.append(d)
    return pd.DataFrame(out)


# ---------------------------------------------------------------------------
# Labels derived from the dataset's alert text (used ONLY to create y, then the
# column is dropped - it is never a model input)
# ---------------------------------------------------------------------------
def condition_from_alert(text: str) -> str:
    t = str(text or "").lower()
    if "mastitis" in t:
        return "Mastitis"
    if "ketosis" in t:
        return "Ketosis"
    return "Healthy"


# ---------------------------------------------------------------------------
# Milk quality grading (standards based)
# ---------------------------------------------------------------------------
# FSSAI minimums (Food Safety and Standards Regulations 2011, milk products)
FSSAI_MIN = {
    "cow": {"fat": 3.2, "snf": 8.3},
    "buffalo": {"fat": 5.0, "snf": 9.0},
    "mixed": {"fat": 4.5, "snf": 8.5},
}


def grade_quality(inp: Dict[str, Any], species: str = "cow") -> Dict[str, Any]:
    """Good / Average / Poor with human readable reasons. Works with any field missing."""
    s = (species or "cow").lower()
    mins = FSSAI_MIN.get(s, FSSAI_MIN["cow"])
    fat, snf, clr = _num(inp.get("fat")), _num(inp.get("snf")), _num(inp.get("clr"))
    protein, water = _num(inp.get("protein")), _num(inp.get("added_water"))

    score, reasons, checks = 100.0, [], 0

    if water is not None:
        checks += 1
        if water >= 8:
            score -= 50
            reasons.append(("bad", f"Added water {water:g}% - adulteration, milk would be rejected or down-priced"))
        elif water >= 3:
            score -= 20
            reasons.append(("warn", f"Added water {water:g}% - above the 3% tolerance"))
        elif water > 0:
            score -= 5
            reasons.append(("ok", f"Added water {water:g}% - within tolerance"))
        else:
            reasons.append(("ok", "No added water detected"))

    if fat is not None:
        checks += 1
        if fat < mins["fat"] - 0.3:
            score -= 30
            reasons.append(("bad", f"Fat {fat:g}% is well below the FSSAI {s} minimum of {mins['fat']}%"))
        elif fat < mins["fat"]:
            score -= 15
            reasons.append(("warn", f"Fat {fat:g}% is just below the FSSAI {s} minimum of {mins['fat']}%"))
        else:
            reasons.append(("ok", f"Fat {fat:g}% meets the FSSAI {s} minimum ({mins['fat']}%)"))

    if snf is not None:
        checks += 1
        if snf < mins["snf"] - 0.5:
            score -= 30
            reasons.append(("bad", f"SNF {snf:g}% is well below the FSSAI {s} minimum of {mins['snf']}%"))
        elif snf < mins["snf"]:
            score -= 15
            reasons.append(("warn", f"SNF {snf:g}% is just below the FSSAI {s} minimum of {mins['snf']}%"))
        else:
            reasons.append(("ok", f"SNF {snf:g}% meets the FSSAI {s} minimum ({mins['snf']}%)"))

    if clr is not None:
        checks += 1
        if clr < 26:
            score -= 10
            reasons.append(("warn", f"CLR {clr:g} is below the normal 26-32 range (thin milk / possible water)"))
        elif clr > 33:
            score -= 5
            reasons.append(("warn", f"CLR {clr:g} is above the normal 26-32 range"))

    if protein is not None and protein < 2.8:
        checks += 1
        score -= 10
        reasons.append(("warn", f"Protein {protein:g}% is below 2.8%"))

    score = max(0.0, min(100.0, score))
    grade = "Good" if score >= 80 else ("Average" if score >= 55 else "Poor")
    # hard caps: any failed standard ("bad") -> Poor; any borderline ("warn") -> at most Average
    levels = {lvl for lvl, _ in reasons}
    if "bad" in levels:
        grade, score = "Poor", min(score, 54.0)
    elif "warn" in levels and grade == "Good":
        grade, score = "Average", min(score, 79.0)
    if checks == 0:
        grade, reasons = "Average", [("warn", "Not enough readings to grade - enter at least fat, SNF and added water")]
    return {
        "grade": grade,
        "score": round(score),
        "reasons": [{"level": lvl, "text": t} for lvl, t in reasons],
        "standard": f"FSSAI {s} milk",
    }


# ---------------------------------------------------------------------------
# Optional lab-reading rules (EC / SCC) - literature thresholds
# ---------------------------------------------------------------------------
EC_MASTITIS = 6.5        # mS/cm - commonly used mastitis cut-off for whole milk
SCC_SUBCLINICAL = 200_000  # cells/mL - standard subclinical mastitis threshold


def lab_evidence(ec: Optional[float], scc: Optional[float]) -> Dict[str, Any]:
    """Returns how EC / SCC shift the mastitis probability (or nothing when blank)."""
    ec, scc = _num(ec), _num(scc)
    notes, boost, lower = [], 0.0, 0.0
    if ec is not None:
        if ec > EC_MASTITIS:
            boost = max(boost, 0.35)
            notes.append(("bad", f"Electrical conductivity {ec:g} mS/cm is above {EC_MASTITIS} - supports mastitis"))
        else:
            lower += 0.10
            notes.append(("ok", f"Electrical conductivity {ec:g} mS/cm is normal"))
    if scc is not None:
        if scc > SCC_SUBCLINICAL:
            boost = max(boost, 0.45 if scc > 400_000 else 0.30)
            notes.append(("bad", f"Somatic cell count {int(scc):,} cells/mL is above {SCC_SUBCLINICAL:,} - udder inflammation likely"))
        else:
            lower += 0.10
            notes.append(("ok", f"Somatic cell count {int(scc):,} cells/mL is normal"))
    if ec is None and scc is None:
        notes.append(("info", "EC and SCC not provided - prediction uses the milk-composition model only. Adding them makes it more reliable."))
    return {"boost": boost, "lower": min(lower, 0.2), "notes": notes, "provided": [k for k, v in (("ec", ec), ("scc", scc)) if v is not None]}
