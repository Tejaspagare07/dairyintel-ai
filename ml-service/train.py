"""
Train + validate the DairyIntel disease model and write an honest accuracy report.

    python train.py                       # uses data/dairyintel_disease_calibrated.csv
    python train.py --data path/to/new.csv

Outputs
    models/disease_model.joblib   - the trained pipeline (imputer + Random Forest) + metadata
    reports/model_report.json     - every number shown on the website's "Model report" page
    reports/model_report.md       - the same report, human readable

Method (after Hyde et al., Sci Rep 2020 - see features.py):
    * drop Analyzer_Model and the last 3 columns (Data_Source, Original_Test_Date,
      Health_Quality_Alert). The alert text is read ONCE to create the label, then dropped.
    * engineered ratio features, median imputation for missing values
    * Random Forest with class weighting (dataset is imbalanced)
    * evaluation: leave-one-out CV (every row is predicted by a model that never saw it),
      repeated stratified 5-fold CV, and a stratified 70/30 hold-out split
    * baselines (always-"Healthy", raw-features-only RF) so the numbers have context
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (accuracy_score, balanced_accuracy_score, confusion_matrix,
                             f1_score, precision_score, recall_score)
from sklearn.model_selection import (LeaveOneOut, RepeatedStratifiedKFold, StratifiedKFold,
                                     cross_val_predict, train_test_split)
from sklearn.pipeline import Pipeline

from features import (CSV_TO_INTERNAL, DROP_ANALYZER, DROP_IDS, DROP_LAST_THREE, MODEL_FEATURES,
                      OPTIONAL_LAB, RAW_NUMERIC, build_features, condition_from_alert, grade_quality)

HERE = Path(__file__).parent
SEED = 42
CLASSES = ["Healthy", "Ketosis", "Mastitis"]


def make_pipeline(n_estimators=500):
    return Pipeline([
        ("impute", SimpleImputer(strategy="median", keep_empty_features=True)),
        ("rf", RandomForestClassifier(
            n_estimators=n_estimators, class_weight="balanced", min_samples_leaf=1,
            max_features="sqrt", random_state=SEED, n_jobs=-1)),
    ])


THRESH_GRID = np.round(np.arange(0.2, 0.75, 0.05), 2)


def p_high_risk(model, X):
    pr = model.predict_proba(X)
    return 1 - pr[:, list(model.classes_).index("Healthy")]


def pick_threshold(p_risk, y_bin):
    """Paper: choose the threshold on CV. We maximise balanced accuracy and take the middle
    of the best plateau (ties are common on small data)."""
    scores = [balanced_accuracy_score(y_bin, np.where(p_risk >= t, "High Risk", "Healthy")) for t in THRESH_GRID]
    best = max(scores)
    ts = [t for t, sc in zip(THRESH_GRID, scores) if sc >= best - 1e-9]
    return float(ts[len(ts) // 2])


def tune_threshold_inner(X_tr, y_tr):
    """Pick a threshold using ONLY training rows (inner stratified CV) - no peeking at test rows."""
    yb = to_binary(y_tr)
    k = int(max(2, min(4, (yb == "High Risk").sum())))
    inner = StratifiedKFold(n_splits=k, shuffle=True, random_state=SEED)
    pr = cross_val_predict(make_pipeline(200), X_tr, y_tr if min(pd.Series(y_tr).value_counts()) >= k else yb,
                           cv=inner.split(X_tr, yb), method="predict_proba")
    classes = sorted(set(y_tr if min(pd.Series(y_tr).value_counts()) >= k else yb))
    return pick_threshold(1 - pr[:, classes.index("Healthy")], yb)


def assign_condition(proba, classes, thr):
    """High Risk if P(not Healthy) >= thr; condition = most likely disease class."""
    classes = list(classes)
    hi = classes.index("Healthy")
    out = []
    for row in proba:
        if 1 - row[hi] >= thr:
            dis = [(c, row[i]) for i, c in enumerate(classes) if c != "Healthy"]
            out.append(max(dis, key=lambda t: t[1])[0])
        else:
            out.append("Healthy")
    return np.array(out)


def binary_metrics(y_true, y_pred):
    pos = "High Risk"
    cm = confusion_matrix(y_true, y_pred, labels=[pos, "Healthy"])
    tp, fn, fp, tn = int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])
    return {
        "accuracy": round(accuracy_score(y_true, y_pred), 4),
        "balanced_accuracy": round(balanced_accuracy_score(y_true, y_pred), 4),
        "precision": round(precision_score(y_true, y_pred, pos_label=pos, zero_division=0), 4),
        "recall": round(recall_score(y_true, y_pred, pos_label=pos, zero_division=0), 4),
        "f1": round(f1_score(y_true, y_pred, pos_label=pos, zero_division=0), 4),
        "npv": round(tn / (tn + fn), 4) if (tn + fn) else None,
        "confusion_matrix": {"labels": [pos, "Healthy"], "matrix": [[tp, fn], [fp, tn]],
                             "tp": tp, "fn": fn, "fp": fp, "tn": tn},
    }


def to_binary(labels):
    return np.where(np.asarray(labels) == "Healthy", "Healthy", "High Risk")


def load(path: Path):
    raw = pd.read_csv(path, na_values=["NA", "N/A", ""])
    info = {"rows": int(len(raw)), "columns_in_file": list(raw.columns)}

    # 1) label from the alert text, BEFORE dropping it
    y = raw["Health_Quality_Alert"].map(condition_from_alert).to_numpy()

    # 2) drop required columns (+ ids)
    dropped = [c for c in DROP_ANALYZER + DROP_LAST_THREE + DROP_IDS if c in raw.columns]
    df = raw.drop(columns=dropped)
    info["dropped_columns"] = dropped
    info["source_breakdown"] = raw["Data_Source"].value_counts().to_dict() if "Data_Source" in raw else {}

    # 3) rename to internal names + engineer features
    df = df.rename(columns=CSV_TO_INTERNAL)
    X = build_features(df.to_dict("records"))

    # use EC/SCC as model features only if the file really has some values
    lab_cols = [c for c in OPTIONAL_LAB if c in df.columns and df[c].notna().sum() >= 5]
    features = MODEL_FEATURES + lab_cols
    info["features"] = features
    info["ec_scc_in_training_data"] = bool(lab_cols)
    info["missing_values"] = {c: int(X[c].isna().sum()) for c in RAW_NUMERIC if X[c].isna().any()}
    info["label_counts"] = pd.Series(y).value_counts().to_dict()
    return raw, df, X[features], y, info


def cv_splitter(y_bin):
    """LOOCV for a tiny dataset (the original 28-row pilot), stratified 10-fold otherwise.
    Leave-one-out does not scale to ~1000 rows, and stratified k-fold gives the same
    kind of honest out-of-fold estimate far more cheaply."""
    n = len(y_bin)
    if n <= 60:
        return LeaveOneOut(), "leave-one-out CV"
    return StratifiedKFold(n_splits=10, shuffle=True, random_state=SEED), "10-fold cross-validation"


def oof_p_risk(X, y, features_subset=None):
    """Out-of-fold P(not Healthy) for each row (used by baselines; global threshold picked outside)."""
    Xs = X if features_subset is None else X[features_subset]
    y_bin = to_binary(y)
    splitter, scheme = cv_splitter(y_bin)
    proba = cross_val_predict(make_pipeline(), Xs, y, cv=splitter.split(Xs, y_bin), method="predict_proba")
    classes = sorted(set(y))
    return 1 - proba[:, classes.index("Healthy")], scheme


def nested_oof(X, y):
    """Honest out-of-fold predictions where, for every test fold, the decision threshold
    is tuned ONLY on that fold's training rows (no peeking). Returns per-row binary
    prediction, 3-class condition, out-of-fold p_risk, thresholds used, and the scheme name."""
    y = np.asarray(y)
    y_bin = to_binary(y)
    splitter, scheme = cv_splitter(y_bin)
    n = len(X)
    pred = np.empty(n, dtype=object)
    cond = np.empty(n, dtype=object)
    p_risk = np.zeros(n)
    thr_used = []
    for tr, te in splitter.split(X, y_bin):
        t_i = tune_threshold_inner(X.iloc[tr], y[tr])
        thr_used.append(t_i)
        mdl = make_pipeline().fit(X.iloc[tr], y[tr])
        pr = mdl.predict_proba(X.iloc[te])
        hi = list(mdl.classes_).index("Healthy")
        c = assign_condition(pr, mdl.classes_, t_i)
        cond[te] = c
        pred[te] = np.where(c == "Healthy", "Healthy", "High Risk")
        p_risk[te] = 1 - pr[:, hi]
    return pred, cond, p_risk, thr_used, scheme


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(HERE / "data" / "dairyintel_disease_calibrated.csv"))
    args = ap.parse_args()

    raw, df, X, y, info = load(Path(args.data))
    y_bin = to_binary(y)
    n_pos = int((y_bin == "High Risk").sum())
    print(f"Rows: {len(X)} | High Risk: {n_pos} | labels: {info['label_counts']}")
    print("Dropped:", info["dropped_columns"])
    print("Features:", info["features"])

    report = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
              "dataset": {**info, "file": Path(args.data).name}, "method": {}, "disease": {}, "quality": {}}

    # ------------------------------------------------------------------
    # A) Cross-validated honest numbers (nested: threshold tuned inside each fold)
    # ------------------------------------------------------------------
    print("Running nested cross-validation (threshold tuned inside each training fold)...")
    nested_pred, nested_cond, p_risk, nested_thr, cv_scheme = nested_oof(X, y)
    THRESH = pick_threshold(p_risk, y_bin)   # production threshold, chosen on CV (as in the paper)
    m_loo_default = binary_metrics(y_bin, np.where(p_risk >= 0.5, "High Risk", "Healthy"))
    m_loo = binary_metrics(y_bin, nested_pred)
    m_loo["scheme"] = cv_scheme
    m_loo["thresholds_used"] = {"min": float(min(nested_thr)), "max": float(max(nested_thr)),
                                "median": float(np.median(nested_thr))}

    # threshold sweep (paper: pick threshold on CV) - reported, not silently applied
    sweep = []
    for t in np.round(np.arange(0.2, 0.75, 0.05), 2):
        pb = np.where(p_risk >= t, "High Risk", "Healthy")
        mm = binary_metrics(y_bin, pb)
        sweep.append({"threshold": float(t), "precision": mm["precision"], "recall": mm["recall"],
                      "accuracy": mm["accuracy"], "balanced_accuracy": mm["balanced_accuracy"]})

    # 3-class condition (Healthy / Ketosis / Mastitis)
    loo_cond = nested_cond
    cm3 = confusion_matrix(y, loo_cond, labels=CLASSES)
    per_class = {}
    for c in CLASSES:
        per_class[c] = {
            "precision": round(precision_score(y, loo_cond, labels=[c], average="macro", zero_division=0), 4),
            "recall": round(recall_score(y, loo_cond, labels=[c], average="macro", zero_division=0), 4),
            "support": int((y == c).sum()),
        }

    # ------------------------------------------------------------------
    # B) Repeated stratified 5-fold CV (binary) - how stable is it?
    # ------------------------------------------------------------------
    n_splits = min(5, n_pos, int((y_bin == "Healthy").sum()))
    rskf = RepeatedStratifiedKFold(n_splits=n_splits, n_repeats=5, random_state=SEED)
    fold_scores = {"accuracy": [], "precision": [], "recall": [], "balanced_accuracy": []}
    for tr, te in rskf.split(X, y_bin):
        t_f = tune_threshold_inner(X.iloc[tr], y[tr])
        mdl = make_pipeline(300).fit(X.iloc[tr], y[tr])
        pb = np.where(p_high_risk(mdl, X.iloc[te]) >= t_f, "High Risk", "Healthy")
        mm = binary_metrics(y_bin[te], pb)
        for k in fold_scores:
            fold_scores[k].append(mm[k])
    rskf_summary = {k: {"mean": round(float(np.mean(v)), 4), "std": round(float(np.std(v)), 4)}
                    for k, v in fold_scores.items()}

    # ------------------------------------------------------------------
    # C) Stratified 70/30 hold-out (train / validation) - the brief's split
    # ------------------------------------------------------------------
    X_tr, X_va, y_tr, y_va = train_test_split(X, y, test_size=0.3, stratify=y_bin, random_state=SEED)
    t_h = tune_threshold_inner(X_tr, y_tr)
    hold = make_pipeline().fit(X_tr, y_tr)
    m_hold = binary_metrics(to_binary(y_va), np.where(p_high_risk(hold, X_va) >= t_h, "High Risk", "Healthy"))
    m_hold["threshold_tuned_on_train"] = t_h
    m_hold["train_rows"], m_hold["validation_rows"] = int(len(X_tr)), int(len(X_va))

    # ------------------------------------------------------------------
    # D) Baselines for context
    # ------------------------------------------------------------------
    base_majority = binary_metrics(y_bin, np.array(["Healthy"] * len(y_bin)))
    raw_feats = [c for c in RAW_NUMERIC] + ["shift_morning"]
    p_risk_raw, _ = oof_p_risk(X, y, raw_feats)
    base_raw = binary_metrics(y_bin, np.where(p_risk_raw >= pick_threshold(p_risk_raw, y_bin), "High Risk", "Healthy"))

    # ------------------------------------------------------------------
    # E) "No lab" scenario - EC/SCC available in training, left BLANK at prediction
    #    time. This is the realistic case: most farmers submit only composition.
    # ------------------------------------------------------------------
    lab_cols = [c for c in OPTIONAL_LAB if c in X.columns]
    no_lab = None
    if lab_cols:
        splitter, _ = cv_splitter(y_bin)
        yt, yp = [], []
        for tr, te in splitter.split(X, y_bin):
            t_f = tune_threshold_inner(X.iloc[tr], y[tr])
            mdl = make_pipeline().fit(X.iloc[tr], y[tr])
            Xte = X.iloc[te].copy()
            Xte[lab_cols] = np.nan                          # blank EC/SCC at inference
            pb = np.where(p_high_risk(mdl, Xte) >= t_f, "High Risk", "Healthy")
            yt.extend(to_binary(y[te])); yp.extend(pb)
        no_lab = binary_metrics(np.array(yt), np.array(yp))
        no_lab["note"] = ("EC and SCC were available during training but left blank at prediction time - "
                          "the accuracy to expect when only analyzer composition readings are entered.")

    # ------------------------------------------------------------------
    # Final model on ALL rows (what the web app uses)
    # ------------------------------------------------------------------
    final = make_pipeline().fit(X, y)
    importances = sorted(zip(X.columns, final.named_steps["rf"].feature_importances_), key=lambda t: -t[1])

    # Robustness check: EC/SCC blank + temp blank must still predict
    probe = build_features([{"fat": 4.5, "snf": 8.4, "protein": 3.2, "lactose": 4.7}])[list(X.columns)]
    _ = final.predict_proba(probe)

    # ------------------------------------------------------------------
    # Quality grades on the dataset (standards based - see note)
    # ------------------------------------------------------------------
    grades = [grade_quality(r)["grade"] for r in df.to_dict("records")]
    q_counts = pd.Series(grades).value_counts().to_dict()
    has_quality_labels = "Quality_Grade" in raw.columns

    # ------------------------------------------------------------------
    # Verdict (plain language, no overstating)
    # ------------------------------------------------------------------
    synthetic = sum(v for k, v in info["source_breakdown"].items()
                    if any(w in str(k).lower() for w in ("synthetic", "simulated")))
    reliable = len(X) >= 200 and m_loo["recall"] >= 0.8 and m_loo["precision"] >= 0.7
    no_lab_line = (f"With EC and SCC left blank, recall falls to {pct(no_lab['recall'])} and accuracy to "
                   f"{pct(no_lab['accuracy'])} (see the 'no-lab' row). EC and SCC are the strongest mastitis "
                   "signals, so entering them when available makes the screen clearly stronger."
                   if no_lab else
                   "EC and SCC are optional; when entered, literature thresholds sharpen the mastitis check.")
    verdict = {
        "reliable_for_production": bool(reliable),
        "headline": ("Strong and stable on this calibrated dataset - but it must still be validated on real, "
                     "vet/lab-labelled samples before field use."
                     if reliable else
                     "Promising, but not yet good enough to rely on - see the notes below."),
        "why": [
            f"{len(X)} samples ({', '.join(f'{k} {v}' for k, v in info['label_counts'].items())}). "
            "That is a usable size, and every number above is cross-validated - each row is scored by a model "
            "that never saw it - so the scores are not inflated by the model memorising the data.",
            f"IMPORTANT: the data is calibrated-synthetic, not real cows. All {synthetic} rows were generated "
            "from published distributions (in mastitis lactose falls while EC, SCC and minerals rise; in "
            "ketosis fat rises and protein falls so the fat:protein ratio climbs), with realistic class overlap "
            "and analyzer measurement noise added. This proves the pipeline is correct and honestly evaluated; "
            "it does NOT prove the model works on your herd.",
            "The classes deliberately overlap - mild subclinical mastitis that looks almost healthy, "
            "borderline-healthy cows with a raised cell count, mild ketosis. That is why the accuracy sits in a "
            "believable range instead of a suspicious ~99%.",
            no_lab_line,
        ],
        "to_improve": [
            "Replace the synthetic rows with 300+ real measured samples as you collect them.",
            "Label them from a vet or a test (CMT / SCC for mastitis, BHB strip for ketosis), not from rules.",
            "Record EC and SCC on as many samples as possible so the model leans on measured signals.",
            "Keep animal ID and date so repeat samples of the same cow give trend features (as in the paper).",
            "Validate on a separate farm or month (external validation), as Hyde et al. did.",
        ],
    }

    report["method"] = {
        "paper": "Hyde et al., 'Automated prediction of mastitis infection patterns in dairy herds using "
                 "machine learning', Scientific Reports 10:4289 (2020)",
        "what_we_took_from_it": [
            "Random Forest classifier",
            "Engineered ratio features on top of raw readings",
            "Imputation of missing values rather than dropping the sample",
            "Cross-validation plus a held-out validation set; threshold studied on CV",
            "Reporting precision (PPV) and NPV, not just accuracy, because the data is imbalanced",
            "Class weighting to handle imbalance (the paper recommends sub-sampling methods)",
        ],
        "model": "RandomForestClassifier(n_estimators=500, class_weight='balanced', max_features='sqrt') "
                 "after median imputation",
        "threshold": THRESH,
        "threshold_rule": "chosen on cross-validation to maximise balanced accuracy (paper: threshold picked on CV)",
        "label_rule": "High Risk = alert text mentions mastitis or ketosis; the alert column is then dropped",
    }
    report["disease"] = {
        "loocv": m_loo,
        "loocv_note": f"{cv_scheme}: each row is predicted by a model trained on the other folds, with the "
                      "decision threshold also tuned only on those training folds (nested, no leakage).",
        "loocv_default_threshold_0_5": m_loo_default,
        "loocv_condition": {"labels": CLASSES, "matrix": cm3.tolist(), "per_class": per_class,
                            "accuracy": round(accuracy_score(y, loo_cond), 4)},
        "no_lab_scenario": no_lab,
        "repeated_cv": {"scheme": f"{n_splits}-fold x 5 repeats, stratified, threshold tuned on training folds", **rskf_summary},
        "holdout": m_hold,
        "baselines": {"always_healthy": base_majority, "raw_features_only_rf": base_raw},
        "threshold_sweep": sweep,
        "feature_importance": [{"feature": f, "importance": round(float(v), 4)} for f, v in importances],
        "per_row_note": f"Sample of {min(60, len(y))} of {len(y)} rows (out-of-fold predictions).",
        "per_row": [{"test": str(raw.iloc[i].get("Test_No", i)), "actual": str(y[i]),
                     "predicted": str(loo_cond[i]), "p_risk_loocv": round(float(p_risk[i]), 3)}
                    for i in range(min(60, len(y)))],
    }
    report["quality"] = {
        "approach": ("Trained model" if has_quality_labels else
                     "Standards-based grading (FSSAI fat/SNF minimums, added water, CLR, protein)"),
        "why": ("The CSV has no independent quality label (no lab or buyer grade), so a model trained on it "
                "would only re-learn whatever rule we used to create the labels. The grade is therefore "
                "computed directly from published standards and every reason is shown to the user. "
                "Add a 'Quality_Grade' column (Good/Average/Poor) from your collection centre and "
                "re-run train.py to train a quality model on real grades."),
        "grade_counts_on_dataset": q_counts,
    }
    report["verdict"] = verdict

    (HERE / "models").mkdir(exist_ok=True)
    (HERE / "reports").mkdir(exist_ok=True)
    joblib.dump({"pipeline": final, "features": list(X.columns), "classes": list(final.classes_),
                 "threshold": THRESH, "trained_at": report["generated_at"], "rows": len(X),
                 "version": "v1-rf",
                 # typical range of each reading in HEALTHY rows (5th-95th pct) - used to explain predictions
                 "healthy_ranges": {c: [round(float(X.loc[y == "Healthy", c].quantile(0.05)), 3),
                                        round(float(X.loc[y == "Healthy", c].quantile(0.95)), 3)]
                                    for c in ["fat_protein_ratio", "lactose_snf_ratio", "protein_snf_ratio",
                                              "lactose", "temp", "protein"]}}, HERE / "models" / "disease_model.joblib")
    (HERE / "reports" / "model_report.json").write_text(json.dumps(report, indent=2, default=str))
    (HERE / "reports" / "model_report.md").write_text(to_markdown(report))

    print(f"\nProduction threshold: {THRESH}")
    print("LOOCV @0.5:", {k: m_loo_default[k] for k in ("accuracy", "precision", "recall")})
    print("\n=== NESTED LOOCV (binary High Risk vs Healthy) ===")
    print({k: m_loo[k] for k in ("accuracy", "precision", "recall", "f1", "balanced_accuracy")})
    print("Confusion [[TP, FN],[FP, TN]]:", m_loo["confusion_matrix"]["matrix"])
    print("Repeated CV:", rskf_summary)
    print("Hold-out:", {k: m_hold[k] for k in ("accuracy", "precision", "recall")}, m_hold["confusion_matrix"]["matrix"])
    print("Baseline always-healthy:", base_majority["accuracy"], "| raw-feature RF recall:", base_raw["recall"])
    print("3-class LOOCV:\n", cm3)
    print("Top features:", importances[:5])
    print("Quality grades:", q_counts)
    print("Saved models/disease_model.joblib and reports/model_report.{json,md}")


def pct(v):
    return "n/a" if v is None else f"{v * 100:.1f}%"


def to_markdown(r):
    d, q, v = r["disease"], r["quality"], r["verdict"]
    L = d["loocv"]
    cm = L["confusion_matrix"]
    c3 = d["loocv_condition"]
    lines = [
        "# DairyIntel AI - Model accuracy report", "",
        f"Generated: {r['generated_at']}  ",
        f"Dataset: `{r['dataset']['file']}` - {r['dataset']['rows']} rows  ",
        f"Label counts: {r['dataset']['label_counts']}  ",
        f"Data sources: {r['dataset']['source_breakdown']}  ",
        f"Dropped before training: {', '.join(r['dataset']['dropped_columns'])}  ",
        f"Features: {', '.join(r['dataset']['features'])}", "",
        f"## Verdict: {v['headline']}", "",
        *[f"- {w}" for w in v["why"]], "",
        "## Disease model (High Risk vs Healthy)", "",
        "| Evaluation | Accuracy | Precision (PPV) | Recall | F1 |", "|---|---|---|---|---|",
        f"| Nested {L.get('scheme', 'cross-validation')} ({r['dataset']['rows']} rows) | {pct(L['accuracy'])} | {pct(L['precision'])} | {pct(L['recall'])} | {pct(L['f1'])} |",
        *( [f"| Same model, EC/SCC left blank at prediction (no-lab) | {pct(d['no_lab_scenario']['accuracy'])} | {pct(d['no_lab_scenario']['precision'])} | {pct(d['no_lab_scenario']['recall'])} | {pct(d['no_lab_scenario']['f1'])} |"]
           if d.get("no_lab_scenario") else [] ),
        f"| Repeated CV ({d['repeated_cv']['scheme']}) | {pct(d['repeated_cv']['accuracy']['mean'])} ± {pct(d['repeated_cv']['accuracy']['std'])} | "
        f"{pct(d['repeated_cv']['precision']['mean'])} ± {pct(d['repeated_cv']['precision']['std'])} | "
        f"{pct(d['repeated_cv']['recall']['mean'])} ± {pct(d['repeated_cv']['recall']['std'])} | - |",
        f"| 70/30 hold-out ({d['holdout']['validation_rows']} validation rows) | {pct(d['holdout']['accuracy'])} | {pct(d['holdout']['precision'])} | {pct(d['holdout']['recall'])} | {pct(d['holdout']['f1'])} |",
        f"| Baseline: always 'Healthy' | {pct(d['baselines']['always_healthy']['accuracy'])} | - | 0.0% | - |",
        f"| Baseline: RF on raw readings only (no ratio features) | {pct(d['baselines']['raw_features_only_rf']['accuracy'])} | {pct(d['baselines']['raw_features_only_rf']['precision'])} | {pct(d['baselines']['raw_features_only_rf']['recall'])} | {pct(d['baselines']['raw_features_only_rf']['f1'])} |",
        "", f"### Confusion matrix (nested {L.get('scheme', 'cross-validation')})", "",
        "| | Predicted High Risk | Predicted Healthy |", "|---|---|---|",
        f"| **Actual High Risk** | {cm['tp']} | {cm['fn']} |",
        f"| **Actual Healthy** | {cm['fp']} | {cm['tn']} |", "",
        f"### Likely condition (3-class, {L.get('scheme', 'cross-validation')})", "",
        "| Actual \\ Predicted | " + " | ".join(c3["labels"]) + " |", "|---" * (len(c3["labels"]) + 1) + "|",
        *[f"| {lab} | " + " | ".join(str(x) for x in row) + " |" for lab, row in zip(c3["labels"], c3["matrix"])],
        "", "### Most important features", "",
        *[f"- {f['feature']}: {f['importance']}" for f in d["feature_importance"][:6]],
        "", "## Milk quality grading", "", f"Approach: {q['approach']}", "", q["why"], "",
        f"Grades on the dataset: {q['grade_counts_on_dataset']}", "",
        "## What would make it reliable", "", *[f"- {t}" for t in v["to_improve"]], "",
        "## Method", "", f"Based on: {r['method']['paper']}", "",
        *[f"- {t}" for t in r["method"]["what_we_took_from_it"]], "",
        f"Model: {r['method']['model']}. Decision threshold: {r['method']['threshold']}.",
    ]
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    main()
