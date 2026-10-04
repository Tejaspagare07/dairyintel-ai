"""
real_data_experiment.py  —  a REAL public-dataset check for the DairyIntel AI paper.

Why: your disease model is trained on a calibrated-synthetic benchmark. This script
runs the SAME kind of Random Forest pipeline on a genuinely PUBLIC, REAL milk dataset
so the paper can report one result on real observed data (clearly labelled as a
complementary check, not a mastitis validation).

Dataset: the public "Milk Quality" dataset (milknew.csv, ~1,000 real observed samples;
features pH, temperature, taste, odour, fat, turbidity, colour; label = grade
low/medium/high). It is a real, openly available dataset used in several papers.

HOW TO RUN (needs internet + Python):
    pip install pandas scikit-learn
    python real_data_experiment.py

Then copy the printed block back to me and I will insert the REAL numbers + citation
into the paper. Nothing here is fabricated — the numbers come out of your own run.
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                             f1_score, confusion_matrix, classification_report)

# Public copy of the dataset (raw CSV). If this URL ever moves, download
# "milknew.csv" from the Kaggle 'Milk Quality' dataset and set CSV = "milknew.csv".
CSV = "https://raw.githubusercontent.com/shaik1201/Milk-Quality-Prediction/master/milknew.csv"

def main():
    df = pd.read_csv(CSV)
    df.columns = [c.strip() for c in df.columns]
    target = "Grade"
    X = df.drop(columns=[target])
    y = df[target].astype(str)

    pipe = Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("rf", RandomForestClassifier(n_estimators=500, class_weight="balanced",
                                      max_features="sqrt", random_state=42, n_jobs=-1)),
    ])
    cv = StratifiedKFold(n_splits=10, shuffle=True, random_state=42)
    y_pred = cross_val_predict(pipe, X, y, cv=cv)

    acc = accuracy_score(y, y_pred)
    prec = precision_score(y, y_pred, average="macro", zero_division=0)
    rec = recall_score(y, y_pred, average="macro", zero_division=0)
    f1 = f1_score(y, y_pred, average="macro", zero_division=0)

    print("\n================  PASTE THIS BACK TO CLAUDE  ================")
    print(f"Dataset rows                : {len(df)}")
    print(f"Classes                     : {sorted(y.unique())}")
    print(f"Class counts                : {y.value_counts().to_dict()}")
    print(f"Method                      : RandomForest, stratified 10-fold CV")
    print(f"Accuracy                    : {acc*100:.2f}%")
    print(f"Macro precision             : {prec*100:.2f}%")
    print(f"Macro recall                : {rec*100:.2f}%")
    print(f"Macro F1                    : {f1*100:.2f}%")
    print("Confusion matrix (rows=actual, cols=pred), label order:",
          list(sorted(y.unique())))
    print(confusion_matrix(y, y_pred, labels=sorted(y.unique())))
    print("\nPer-class report:")
    print(classification_report(y, y_pred, zero_division=0))
    print("============================================================\n")

if __name__ == "__main__":
    main()