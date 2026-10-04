"""
DairyIntel ML service (FastAPI)

    uvicorn main:app --reload --port 8000

Endpoints
    GET  /                    health
    POST /predict/sample      one milk sample -> quality grade + disease risk (main endpoint)
    POST /predict/quality     quality grade only
    POST /predict/disease     disease risk only (kept for the old frontend/backend contract)
    POST /predict/history     trend check over an animal's recent samples (unchanged logic)

Every numeric field is optional. EC and SCC in particular can be left blank: the model
imputes missing values and the EC/SCC rule layer is simply skipped.
"""
from __future__ import annotations

from pathlib import Path
from typing import List, Optional

import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from features import build_features, grade_quality, lab_evidence

HERE = Path(__file__).parent
MODEL_PATH = HERE / "models" / "disease_model.joblib"

app = FastAPI(title="DairyIntel ML Service", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

BUNDLE = None


def bundle():
    global BUNDLE
    if BUNDLE is None:
        if not MODEL_PATH.exists():
            raise HTTPException(503, "Model not trained yet. Run: python train.py")
        BUNDLE = joblib.load(MODEL_PATH)
    return BUNDLE


# ---------------------------------------------------------------- schemas
class SampleIn(BaseModel):
    fat: Optional[float] = Field(None, ge=0, le=15)
    snf: Optional[float] = Field(None, ge=0, le=15)
    clr: Optional[float] = Field(None, ge=0, le=45)
    protein: Optional[float] = Field(None, ge=0, le=10)
    lactose: Optional[float] = Field(None, ge=0, le=10)
    added_water: Optional[float] = Field(None, ge=0, le=100)
    temp: Optional[float] = Field(None, ge=-5, le=60)
    shift: Optional[str] = None
    species: Optional[str] = "cow"
    ec: Optional[float] = Field(None, ge=0, le=30)          # mS/cm, optional
    scc: Optional[float] = Field(None, ge=0, le=10_000_000)  # cells/mL, optional


# ---------------------------------------------------------------- disease
def _explain(feat_row, ranges):
    notes = []
    labels = {
        "lactose_snf_ratio": ("Lactose-to-SNF ratio", "low", "mastitis lowers lactose"),
        "fat_protein_ratio": ("Fat-to-protein ratio", "high", "a high ratio is an early ketosis sign"),
        "protein_snf_ratio": ("Protein-to-SNF ratio", "any", ""),
        "temp": ("Milk temperature", "high", "warm milk at milking can mean udder inflammation"),
        "lactose": ("Lactose", "low", ""),
    }
    for key, (name, bad_side, why) in labels.items():
        v = feat_row.get(key)
        if v is None or v != v or key not in ranges:
            continue
        lo, hi = ranges[key]
        unit = "°C" if key == "temp" else ("%" if key == "lactose" else "")
        rng = f"typical ≈ {(lo + hi) / 2:.2f}" if hi - lo < 0.02 else f"typical {lo:.2f}-{hi:.2f}"
        tail = f" - {why}" if why else ""
        # small tolerance so values at the edge of the range are not flagged
        tol = 0.01 if key.endswith("ratio") else 0.0
        if v < lo - tol and bad_side in ("low", "any"):
            notes.append(("warn", f"{name} {v:.2f}{unit} is lower than in healthy samples ({rng}){tail}"))
        elif v > hi + tol and bad_side in ("high", "any"):
            notes.append(("warn", f"{name} {v:.2f}{unit} is higher than in healthy samples ({rng}){tail}"))
    return notes


def predict_disease_core(s: SampleIn):
    b = bundle()
    row = s.model_dump()
    X = build_features([row])
    feats = X[b["features"]]
    proba = b["pipeline"].predict_proba(feats)[0]
    classes = list(b["classes"])
    p = {c: float(proba[i]) for i, c in enumerate(classes)}
    p_mast, p_ket = p.get("Mastitis", 0.0), p.get("Ketosis", 0.0)
    model_only = {"Mastitis": round(p_mast, 3), "Ketosis": round(p_ket, 3)}

    # EC / SCC handling. If the trained model already uses EC and SCC as features
    # (the calibrated dataset has them), the model has ALREADY accounted for the
    # readings - applying the rule boost again would double-count them. In that case
    # we keep only the human-readable EC/SCC notes. For an older model that never saw
    # EC/SCC (e.g. the 28-row pilot), the rule layer still adjusts the probability.
    lab = lab_evidence(s.ec, s.scc)
    lab_in_model = any(c in b.get("features", []) for c in ("ec", "scc"))
    if not lab_in_model:
        if lab["boost"]:
            p_mast = p_mast + lab["boost"] * (1 - p_mast)
        elif lab["lower"]:
            p_mast = p_mast * (1 - lab["lower"])
    p_risk = min(1.0, p_mast + p_ket)

    thr = float(b["threshold"])
    high = p_risk >= thr
    condition = None
    if high:
        condition = "Mastitis" if p_mast >= p_ket else "Ketosis"
    risk_level = "High" if high else ("Medium" if p_risk >= thr * 0.6 else "Low")

    reasons = _explain(X.iloc[0].to_dict(), b.get("healthy_ranges", {})) + lab["notes"]
    if not any(l in ("warn", "bad") for l, _ in reasons):
        reasons.insert(0, ("ok", "Milk composition looks like the healthy samples in your data"))
    filled = [k for k in ("fat", "snf", "clr", "protein", "lactose", "added_water", "temp") if row.get(k) is None]
    if filled:
        reasons.append(("info", f"Not provided, filled with typical values: {', '.join(filled)}"))

    likely = {"Mastitis": "Subclinical mastitis", "Ketosis": "Subclinical ketosis"}
    return {
        "status": "High Risk" if high else "Healthy",
        "riskLevel": risk_level,
        "condition": likely.get(condition) if condition else None,
        "diseases": [condition] if condition else [],
        "probabilities": {"Mastitis": round(p_mast, 3), "Ketosis": round(p_ket, 3), "anyRisk": round(p_risk, 3)},
        "modelOnlyProbabilities": model_only,
        "threshold": thr,
        "labInputsUsed": lab["provided"],
        "reasons": [{"level": l, "text": t} for l, t in reasons],
        "explanation": [t for _, t in reasons],  # old field name, kept for compatibility
        "advice": ("Decision support only. Do a CMT / strip-cup test or call a vet for this animal."
                   if high else "No action needed. Keep testing regularly."),
    }


def model_info():
    b = bundle()
    return {"version": b.get("version"), "trainedAt": b.get("trained_at"), "rows": b.get("rows"),
            "threshold": b.get("threshold"), "type": "Random Forest + EC/SCC rules"}


# ---------------------------------------------------------------- endpoints
@app.get("/")
def root():
    ok = MODEL_PATH.exists()
    return {"service": "DairyIntel ML", "status": "running", "modelLoaded": ok,
            **(model_info() if ok else {})}


@app.post("/predict/sample")
def predict_sample(s: SampleIn):
    return {"quality": grade_quality(s.model_dump(), s.species or "cow"),
            "disease": predict_disease_core(s), "model": model_info()}


@app.post("/predict/quality")
def predict_quality(s: SampleIn):
    return grade_quality(s.model_dump(), s.species or "cow")


@app.post("/predict/disease")
def predict_disease(s: SampleIn):
    return predict_disease_core(s)


# ---------------------------------------------------------------- history (trend) check
class DayRecord(BaseModel):
    date: Optional[str] = None
    quantity: Optional[float] = None
    fat: Optional[float] = None
    protein: Optional[float] = None
    lactose: Optional[float] = None
    ec: Optional[float] = None
    scc: Optional[float] = None


class HistoryIn(BaseModel):
    records: List[DayRecord]


def _avg(rows, key):
    vals = [getattr(r, key) for r in rows if getattr(r, key) is not None]
    return sum(vals) / len(vals) if vals else None


@app.post("/predict/history")
def predict_history(h: HistoryIn):
    records = h.records
    if len(records) < 4:
        return {"riskLevel": "Low", "diseases": [], "explanation": ["Not enough history to assess (need at least 4 samples)."]}
    base, recent = records[:-3], records[-3:]
    explanation, diseases, points = [], [], 0
    by, ry = _avg(base, "quantity"), _avg(recent, "quantity")
    be, re_ = _avg(base, "ec"), _avg(recent, "ec")
    bs, rs = _avg(base, "scc"), _avg(recent, "scc")
    rf, rp = _avg(recent, "fat"), _avg(recent, "protein")
    if by and ry and (by - ry) / by * 100 >= 10:
        explanation.append(f"Milk yield dropped {(by - ry) / by * 100:.0f}% in the last 3 samples."); points += 2
    if be and re_ and re_ > be * 1.15:
        explanation.append(f"Electrical conductivity rose ({be:.1f} -> {re_:.1f} mS/cm)."); diseases.append("Mastitis"); points += 2
    if bs and rs and rs > bs * 1.5:
        explanation.append(f"Somatic cell count rose sharply ({int(bs):,} -> {int(rs):,})."); points += 2
        if "Mastitis" not in diseases:
            diseases.append("Mastitis")
    if rf and rp and rp > 0 and rf / rp > 1.5:
        explanation.append(f"Fat-to-protein ratio is high ({rf / rp:.2f})."); diseases.append("Ketosis"); points += 1
    risk = "High" if points >= 3 else ("Medium" if points >= 1 else "Low")
    if diseases and risk != "Low":
        explanation.append("Veterinary check recommended.")
    if not explanation:
        explanation.append("No abnormal trend detected.")
    return {"riskLevel": risk, "diseases": list(dict.fromkeys(diseases)), "explanation": explanation}
