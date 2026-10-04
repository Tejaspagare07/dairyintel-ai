"""
make_dataset.py - build a literature-calibrated dairy dataset for the disease model.

    python make_dataset.py                 # writes dairyintel_disease_calibrated.csv
    python make_dataset.py --n 1000 --seed 42 --out mydata.csv

WHY THIS EXISTS
---------------
Clean, openly-downloadable, *labelled* mastitis / ketosis datasets (with a vet or
a lab test as the ground truth) are scarce - the good studies keep their raw data
behind the paper. So instead of pretending a 28-row pilot file is enough, this
script builds a larger dataset whose feature distributions are drawn from the
published literature, and whose class overlap is deliberately realistic.

It is SYNTHETIC-BUT-CALIBRATED, not real farm data. Every distribution below is
grounded in a citation, and the classes are made to OVERLAP (mild subclinical
cases, borderline-healthy cows, analyzer measurement noise) so that a model
trained on it earns an *honest* accuracy (~mid-80s to low-90s), not a meaningless
99% that only happens when the classes are trivially separable.

CALIBRATION SOURCES
-------------------
* Healthy cow milk composition (fat, SNF, protein, lactose, CLR):
  FSSAI Food Safety & Standards Regulations 2011; NDRI/ICAR crossbred-cow ranges.
* Milk composition change in mastitis - lactose DROPS, minerals (Na/Cl, hence EC)
  RISE, serum/whey protein rises while casein falls, SNF roughly maintained:
  Auldist et al. (1995) J Dairy Res; Kitchen (1981) J Dairy Res; Pyorala (2003).
* Milk electrical conductivity for mastitis, healthy ~4-5.5 mS/cm, mastitis > ~6.5:
  Norberg et al. (2004); the EC>6.5 mS/cm whole-milk cut-off used in the app.
* Somatic cell count thresholds - subclinical > 200,000 cells/mL, bulk/EU limit
  400,000: standard IDF / EU 853/2004 thresholds.
* Ketosis raises milk FAT and lowers PROTEIN, so fat:protein ratio > ~1.4 is the
  classic screening flag; EC and SCC stay normal (it is metabolic, not an udder
  infection): Duffield (2000); van der Drift et al. (2012); Ospina et al. (2010).
* Feature approach (ratio features, imputation, RF, CV) after Hyde et al.,
  Scientific Reports 10:4289 (2020).

The point of the overlap parameters (SEVERITY, mild fractions, NOISE) is that a
real herd is messy: many mastitis cases are mild subclinical ones that look
almost healthy, and some healthy late-lactation cows have a raised SCC. Those are
exactly the rows the model gets wrong - and that is the honest signal we want.
"""
from __future__ import annotations

import argparse
from datetime import date, timedelta

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Class mix (~1000 rows). Realistic-ish but with enough minority support to learn.
# Herd prevalence of subclinical mastitis is commonly 20-40%; ketosis 10-30% in
# early lactation. We keep Healthy the majority so the imbalance is real.
# ---------------------------------------------------------------------------
MIX = {"Healthy": 0.56, "Mastitis": 0.28, "Ketosis": 0.16}

ALERT = {
    "Healthy": "Normal - milk within standards, no disease pattern",
    "Mastitis": "Subclinical mastitis risk - raised SCC / EC, lactose down",
    "Ketosis": "Ketosis risk - high fat:protein ratio, protein down",
}


def _clip(x, lo, hi):
    return np.minimum(np.maximum(x, lo), hi)


def _lognormal_scc(rng, median, sigma, n):
    """SCC is heavily right-skewed -> sample on a log scale around a median."""
    return np.exp(rng.normal(np.log(median), sigma, n))


def gen_class(rng, cls, n):
    """Return a dict of arrays for n animals of one class, BEFORE analyzer noise."""
    # severity in [0,1]: 0 = borderline/mild (overlaps healthy), 1 = severe.
    # Beta(1.6, 2.2) -> many mild cases, fewer severe -> realistic overlap.
    sev = rng.beta(1.6, 2.2, n) if cls != "Healthy" else np.zeros(n)

    # --- protein, lactose, ash (SNF building blocks) ---
    if cls == "Healthy":
        protein = rng.normal(3.32, 0.16, n)
        lactose = rng.normal(4.82, 0.13, n)
        ash = rng.normal(0.72, 0.03, n)
        fat = rng.normal(4.05, 0.42, n)
    elif cls == "Mastitis":
        # lactose falls with severity; casein down but serum protein up -> total
        # protein roughly steady / slightly up; minerals up (feeds EC).
        lactose = rng.normal(4.82, 0.13, n) - sev * rng.uniform(0.5, 1.2, n)
        protein = rng.normal(3.34, 0.18, n) + sev * rng.uniform(0.0, 0.35, n)
        ash = rng.normal(0.72, 0.03, n) + sev * rng.uniform(0.05, 0.18, n)  # Na/Cl up
        fat = rng.normal(3.95, 0.45, n) - sev * rng.uniform(0.0, 0.45, n)
    else:  # Ketosis
        # fat mobilised up, milk protein down -> fat:protein ratio climbs.
        fat = rng.normal(4.05, 0.42, n) + sev * rng.uniform(0.6, 1.9, n)
        protein = rng.normal(3.30, 0.16, n) - sev * rng.uniform(0.3, 0.8, n)
        lactose = rng.normal(4.82, 0.13, n) - sev * rng.uniform(0.0, 0.4, n)
        ash = rng.normal(0.72, 0.03, n)

    protein = _clip(protein, 2.3, 4.2)
    lactose = _clip(lactose, 3.2, 5.3)
    ash = _clip(ash, 0.6, 1.05)
    fat = _clip(fat, 2.8, 7.0)
    snf = protein + lactose + ash  # physically consistent, not a fixed ratio

    # --- CLR from the standard SNF/fat relation: SNF = CLR/4 + 0.25*fat + 0.44 ---
    clr = 4.0 * (snf - 0.25 * fat - 0.44) + rng.normal(0, 0.6, n)
    clr = _clip(clr, 22, 34)

    # --- electrical conductivity (mS/cm) ---
    if cls == "Mastitis":
        ec = rng.normal(5.6, 0.4, n) + sev * rng.uniform(1.0, 3.8, n)  # rises with severity
    else:  # Healthy & Ketosis keep normal EC (ketosis is metabolic)
        ec = rng.normal(4.8, 0.45, n)
    ec = _clip(ec, 3.5, 12.0)

    # --- somatic cell count (cells/mL), log-normal ---
    if cls == "Mastitis":
        # median climbs from subclinical (~250k) to clinical (millions) with severity
        med = 220_000 * np.exp(sev * 2.6)
        scc = _lognormal_scc(rng, 1.0, 0.55, n) * med
    else:
        scc = _lognormal_scc(rng, 95_000, 0.5, n)  # healthy median ~95k
    scc = _clip(scc, 8_000, 9_500_000)

    # --- milk temperature at test (deg C). Clinical mastitis a touch warmer. ---
    temp = rng.normal(32.5, 1.6, n)
    if cls == "Mastitis":
        temp = temp + sev * rng.uniform(0.0, 1.8, n)
    temp = _clip(temp, 26, 40)

    return dict(fat=fat, snf=snf, protein=protein, lactose=lactose, clr=clr,
                ec=ec, scc=scc, temp=temp, sev=sev)


def add_analyzer_noise(rng, d):
    """Instrument imprecision on the REPORTED reading (Lactoscan-class analyzers)."""
    n = len(d["fat"])
    d["fat"] = d["fat"] + rng.normal(0, 0.12, n)
    d["snf"] = d["snf"] + rng.normal(0, 0.10, n)
    d["protein"] = d["protein"] + rng.normal(0, 0.06, n)
    d["lactose"] = d["lactose"] + rng.normal(0, 0.06, n)
    d["clr"] = d["clr"] + rng.normal(0, 0.4, n)
    d["ec"] = d["ec"] + rng.normal(0, 0.15, n)
    d["scc"] = d["scc"] * np.exp(rng.normal(0, 0.12, n))  # multiplicative on a count
    d["temp"] = d["temp"] + rng.normal(0, 0.4, n)
    return d


def build(n=1000, seed=42):
    rng = np.random.default_rng(seed)
    counts = {c: int(round(n * f)) for c, f in MIX.items()}
    counts["Healthy"] += n - sum(counts.values())  # make the totals add up

    frames = []
    for cls, k in counts.items():
        d = add_analyzer_noise(rng, gen_class(rng, cls, k))
        df = pd.DataFrame({
            "Fat_%": d["fat"].round(2),
            "SNF_%": d["snf"].round(2),
            "CLR_Density": d["clr"].round(1),
            "Protein_%": d["protein"].round(2),
            "Lactose_%": d["lactose"].round(2),
            "Milk_Temp_C": d["temp"].round(1),
            "EC_mS_cm": d["ec"].round(2),
            "SCC_cells_ml": d["scc"].round(0).astype(int),
            "Health_Quality_Alert": ALERT[cls],
        })
        frames.append(df)

    data = pd.concat(frames, ignore_index=True)
    data = data.sample(frac=1.0, random_state=seed).reset_index(drop=True)  # shuffle

    # Added water = 0 for this disease dataset (adulteration is graded separately by
    # the FSSAI quality engine, so we do not confound the two here).
    data["Added_Water_%"] = 0.0

    # Realistic missingness: not every sample gets EC/SCC in the lab. Blank ~18%
    # of them at random (MCAR) so the model must cope with, and be evaluated with,
    # missing lab readings. This mirrors how the app is actually used.
    for col in ("EC_mS_cm", "SCC_cells_ml"):
        miss = rng.random(len(data)) < 0.18
        data.loc[miss, col] = np.nan

    # Shift, ids, bookkeeping columns (Test_No/Date/Analyzer_Model/Data_Source/
    # Original_Test_Date are dropped by train.py; kept so the schema matches the app).
    data.insert(0, "Test_No", [f"C{ i+1:04d}" for i in range(len(data))])
    start = date(2026, 1, 1)
    data.insert(1, "Date", [(start + timedelta(days=int(i) % 120)).isoformat() for i in range(len(data))])
    data.insert(2, "Shift", rng.choice(["Morning", "Evening"], len(data)))
    data["Analyzer_Model"] = "Lactoscan-class (calibrated synthetic)"
    data["Data_Source"] = "calibrated_synthetic"
    data["Original_Test_Date"] = data["Date"]

    # Column order that matches the original app CSV
    cols = ["Test_No", "Date", "Shift", "Fat_%", "SNF_%", "CLR_Density", "Protein_%",
            "Lactose_%", "Added_Water_%", "Milk_Temp_C", "EC_mS_cm", "SCC_cells_ml",
            "Analyzer_Model", "Data_Source", "Original_Test_Date", "Health_Quality_Alert"]
    return data[cols]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=1000)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default="dairyintel_disease_calibrated.csv")
    a = ap.parse_args()
    df = build(a.n, a.seed)
    df.to_csv(a.out, index=False)
    print(f"Wrote {a.out}  ({len(df)} rows)")
    print("Label counts:\n", df["Health_Quality_Alert"].map(
        lambda t: "Mastitis" if "mastitis" in t.lower() else ("Ketosis" if "ketosis" in t.lower() else "Healthy")
    ).value_counts())
    print("EC/SCC missing:", int(df["EC_mS_cm"].isna().sum()), "/", len(df))


if __name__ == "__main__":
    main()
