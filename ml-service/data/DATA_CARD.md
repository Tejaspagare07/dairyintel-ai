# Data card — `dairyintel_disease_calibrated.csv`

**What it is:** 1,000 milk-sample rows used to train the DairyIntel disease model
(Healthy / Mastitis / Ketosis). It is **calibrated-synthetic**: every feature is
drawn from distributions taken from the published literature, with realistic class
overlap and analyzer measurement noise added. It is **not** real farm data.

**Why synthetic:** clean, openly-downloadable, *labelled* mastitis/ketosis datasets
(with a vet or a lab test as ground truth) are scarce — the strong studies keep their
raw data behind the paper. Rather than train on the 28-row pilot file, this dataset
gives the model enough calibrated, honestly-evaluated examples to learn the right
biology, while being transparent that field validation is still required.

Reproduce it: `python data/make_dataset.py --n 1000 --seed 42`

---

## Columns

| Column | Meaning | Used by model? |
|---|---|---|
| `Test_No`, `Date` | identifiers | dropped |
| `Shift` | Morning / Evening | `shift_morning` feature |
| `Fat_%`, `SNF_%`, `CLR_Density`, `Protein_%`, `Lactose_%`, `Added_Water_%`, `Milk_Temp_C` | analyzer readings | yes (+ engineered ratios) |
| `EC_mS_cm` | electrical conductivity (mS/cm) | yes — **~18% blank** on purpose |
| `SCC_cells_ml` | somatic cell count (cells/mL) | yes — **~18% blank** on purpose |
| `Analyzer_Model`, `Data_Source`, `Original_Test_Date` | bookkeeping | dropped |
| `Health_Quality_Alert` | label source (read once → Healthy/Mastitis/Ketosis, then dropped) | label only |

Class mix: **Healthy 560 · Mastitis 280 · Ketosis 160.**

---

## How each class was generated (and the source for it)

**Healthy** — normal crossbred-cow composition: fat ≈ 4.0%, SNF ≈ 8.8%, protein ≈ 3.3%,
lactose ≈ 4.8%, CLR ≈ 29, EC ≈ 4.8 mS/cm, SCC median ≈ 95k, fat:protein ≈ 1.2.
*Sources: FSSAI Food Safety & Standards Regulations 2011; NDRI/ICAR crossbred ranges.*

**Mastitis** — lactose **falls** (~4.4%), EC **rises** (median ≈ 6.7 mS/cm), SCC **rises**
(median ~250k subclinical → millions clinical), minerals/serum-protein up so total protein
holds/edges up, SNF roughly maintained.
*Sources: Auldist et al. 1995 (J Dairy Res); Kitchen 1981; Pyörälä 2003; Norberg et al. 2004
(EC); IDF / EU 853/2004 SCC thresholds (200k subclinical, 400k bulk limit). EC cut-off
6.5 mS/cm as used in the app.*

**Ketosis** — fat **rises** (~4.7%+), protein **falls** (~3.0%), so **fat:protein climbs past
~1.4** (the classic screen); EC and SCC stay **normal** (it is metabolic, not an udder
infection — which is what lets EC/SCC separate it from mastitis).
*Sources: Duffield 2000; van der Drift et al. 2012; Ospina et al. 2010.*

**Realism built in (this is why accuracy is ~88%, not a fake ~99%):**
- A `severity` variable (Beta-distributed) makes most disease cases **mild** and a few severe,
  so many mastitis cases sit below EC 6.5 / SCC 200k and many ketosis cases below fat:protein 1.4.
- **Analyzer measurement noise** added to every reading (fat ±0.12, SNF ±0.10, protein/lactose
  ±0.06, CLR ±0.4, EC ±0.15, SCC ×lognormal).
- SNF is built from protein + lactose + minerals (**not** a fixed ratio), so `lactose:SNF`
  is a genuine signal rather than a give-away — this fixes the artifact in the old pilot file.
- EC/SCC blanked in ~18% of rows (missing-completely-at-random) to mirror real use.

---

## Model results on this data (cross-validated, from `train.py`)

| Evaluation | Accuracy | Precision | Recall |
|---|---|---|---|
| Nested 10-fold CV (with EC/SCC) | ~88% | ~91% | ~82% |
| Same model, **EC/SCC left blank** | ~81% | ~87% | ~66% |
| Repeated stratified CV | ~88% ± 2% | ~90% ± 3% | ~83% ± 5% |
| Baseline: always "Healthy" | 56% | – | 0% |

Per condition: **Mastitis ~92% recall**, **Ketosis ~58% recall** (mild ketosis is the
honest weak spot). Top features: **EC, SCC, fat÷protein ratio** — the model reads the real biology.

## Honest limitations

- Calibrated-synthetic, **not** real cows. Real herds are messier; expect lower numbers in the field.
- Labels come from the generating rules, not a vet/lab. This proves the pipeline, not field efficacy.
- Cow milk only (FSSAI cow grading). Buffalo/mixed would need their own calibration.
- To make it production-grade: collect 300+ real measured samples, label from CMT/SCC (mastitis)
  and BHB strips (ketosis), record EC/SCC, and validate on a separate farm or month.
  Then `python train.py --data data/your_real_file.csv` and the app's report page updates itself.
