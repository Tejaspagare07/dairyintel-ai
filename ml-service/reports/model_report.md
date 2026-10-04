# DairyIntel AI - Model accuracy report

Generated: 2026-09-20T16:21:41+00:00  
Dataset: `dairyintel_disease_calibrated.csv` - 1000 rows  
Label counts: {'Healthy': 560, 'Mastitis': 280, 'Ketosis': 160}  
Data sources: {'calibrated_synthetic': 1000}  
Dropped before training: Analyzer_Model, Data_Source, Original_Test_Date, Health_Quality_Alert, Test_No, Date  
Features: fat, snf, clr, protein, lactose, added_water, temp, fat_protein_ratio, lactose_snf_ratio, protein_snf_ratio, shift_morning, temp_missing, ec, scc

## Verdict: Strong and stable on this calibrated dataset - but it must still be validated on real, vet/lab-labelled samples before field use.

- 1000 samples (Healthy 560, Mastitis 280, Ketosis 160). That is a usable size, and every number above is cross-validated - each row is scored by a model that never saw it - so the scores are not inflated by the model memorising the data.
- IMPORTANT: the data is calibrated-synthetic, not real cows. All 1000 rows were generated from published distributions (in mastitis lactose falls while EC, SCC and minerals rise; in ketosis fat rises and protein falls so the fat:protein ratio climbs), with realistic class overlap and analyzer measurement noise added. This proves the pipeline is correct and honestly evaluated; it does NOT prove the model works on your herd.
- The classes deliberately overlap - mild subclinical mastitis that looks almost healthy, borderline-healthy cows with a raised cell count, mild ketosis. That is why the accuracy sits in a believable range instead of a suspicious ~99%.
- With EC and SCC left blank, recall falls to 65.0% and accuracy to 80.2% (see the 'no-lab' row). EC and SCC are the strongest mastitis signals, so entering them when available makes the screen clearly stronger.

## Disease model (High Risk vs Healthy)

| Evaluation | Accuracy | Precision (PPV) | Recall | F1 |
|---|---|---|---|---|
| Nested 10-fold cross-validation (1000 rows) | 88.4% | 90.7% | 82.0% | 86.2% |
| Same model, EC/SCC left blank at prediction (no-lab) | 80.2% | 86.7% | 65.0% | 74.3% |
| Repeated CV (5-fold x 5 repeats, stratified, threshold tuned on training folds) | 87.8% ± 1.9% | 89.8% ± 4.1% | 82.0% ± 5.0% | - |
| 70/30 hold-out (300 validation rows) | 85.0% | 82.2% | 84.1% | 83.2% |
| Baseline: always 'Healthy' | 56.0% | - | 0.0% | - |
| Baseline: RF on raw readings only (no ratio features) | 81.1% | 81.6% | 73.6% | 77.4% |

### Confusion matrix (nested 10-fold cross-validation)

| | Predicted High Risk | Predicted Healthy |
|---|---|---|
| **Actual High Risk** | 361 | 79 |
| **Actual Healthy** | 37 | 523 |

### Likely condition (3-class, 10-fold cross-validation)

| Actual \ Predicted | Healthy | Ketosis | Mastitis |
|---|---|---|---|
| Healthy | 523 | 32 | 5 |
| Ketosis | 60 | 96 | 4 |
| Mastitis | 19 | 3 | 258 |

### Most important features

- ec: 0.1714
- scc: 0.1612
- fat_protein_ratio: 0.1305
- fat: 0.0951
- lactose: 0.0878
- lactose_snf_ratio: 0.0857

## Milk quality grading

Approach: Standards-based grading (FSSAI fat/SNF minimums, added water, CLR, protein)

The CSV has no independent quality label (no lab or buyer grade), so a model trained on it would only re-learn whatever rule we used to create the labels. The grade is therefore computed directly from published standards and every reason is shown to the user. Add a 'Quality_Grade' column (Good/Average/Poor) from your collection centre and re-run train.py to train a quality model on real grades.

Grades on the dataset: {'Good': 875, 'Average': 117, 'Poor': 8}

## What would make it reliable

- Replace the synthetic rows with 300+ real measured samples as you collect them.
- Label them from a vet or a test (CMT / SCC for mastitis, BHB strip for ketosis), not from rules.
- Record EC and SCC on as many samples as possible so the model leans on measured signals.
- Keep animal ID and date so repeat samples of the same cow give trend features (as in the paper).
- Validate on a separate farm or month (external validation), as Hyde et al. did.

## Method

Based on: Hyde et al., 'Automated prediction of mastitis infection patterns in dairy herds using machine learning', Scientific Reports 10:4289 (2020)

- Random Forest classifier
- Engineered ratio features on top of raw readings
- Imputation of missing values rather than dropping the sample
- Cross-validation plus a held-out validation set; threshold studied on CV
- Reporting precision (PPV) and NPV, not just accuracy, because the data is imbalanced
- Class weighting to handle imbalance (the paper recommends sub-sampling methods)

Model: RandomForestClassifier(n_estimators=500, class_weight='balanced', max_features='sqrt') after median imputation. Decision threshold: 0.6.
