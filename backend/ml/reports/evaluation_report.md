# GinhawAI vulnerability model: evaluation report

Generated 2026-10-22T10:13:18+00:00 by `python -m ml.train` (XGBoost 3.2.0, scikit-learn 1.9.1).

## Data
- 12,000 synthetic households from `ml/config.json` (seed 2026); no real citizen data.
- Distributions follow public statistics (PSA poverty thresholds, FIES income brackets, CBMS-style indicators); values marked VERIFY in the config must be checked against those sources.
- Reference labels: CBMS-style deprivation points with tier cut-offs, plus 5% label noise to mimic assessor disagreement. The weights stand in for social-worker judgement and are to be reviewed by the licensed social workers.
- The sample deliberately over-represents low-income households (the system's intended users): 36% are below the per-capita poverty threshold.
- Tier shares: low 29%, moderate 36%, high 35%.
- Split: 9,600 training / 2,400 held-out test (stratified).

## Model
scikit-learn `Pipeline`: one-hot encoding of work situation, housing and crisis; numeric and yes/no answers passed through; `XGBClassifier` (3 classes, softprob).
Hyper-parameters chosen by 5-fold stratified cross-validation on Cohen's Kappa: {'learning_rate': 0.1, 'max_depth': 3, 'n_estimators': 300}.

## Results (held-out test set)
| Metric | XGBoost | 5-fold CV (mean ± sd) |
|---|---|---|
| Accuracy | 89.8% | 89.9% ± 0.9% |
| Cohen's Kappa | 0.846 | 0.847 ± 0.014 |
| Macro F1 | 0.900 | 0.901 ± 0.009 |

Target from the manuscript: Kappa ≥ 0.6 → the model **meets** it on the synthetic test set.

**Important:** this measures agreement with the synthetic reference labels. The manuscript's validity test is the Blind Cross-Validation against 3–5 licensed social workers on 30–50 cases (admin console → Blind Validation); report that Kappa as the main result.

### Confusion matrix (rows = reference tier, columns = predicted)
|  | pred. low | pred. moderate | pred. high |
|---|---|---|---|
| **low** | 622 | 70 | 0 |
| **moderate** | 44 | 765 | 62 |
| **high** | 0 | 69 | 768 |

### Per tier
| Tier | Precision | Recall | F1 | Cases |
|---|---|---|---|---|
| low | 0.934 | 0.899 | 0.916 | 692 |
| moderate | 0.846 | 0.878 | 0.862 | 871 |
| high | 0.925 | 0.918 | 0.921 | 837 |

### Compared with the previous rule-based score (same test set)
|  | Accuracy | Cohen's Kappa |
|---|---|---|
| Rule-based placeholder | 54.7% | 0.335 |
| XGBoost | 89.8% | 0.846 |

## Explainability
Each citizen's top three factors come from XGBoost's built-in **exact Tree SHAP** contributions (`pred_contribs=True`) toward the high-risk class, summed per answer and turned into plain-language sentences in Filipino, Bisaya or English.

### What matters most overall (mean absolute contribution to the high-risk score)
| Answer | Mean absolute contribution |
|---|---|
| per_capita_income | 1.863 |
| crisis_type | 0.810 |
| employment_status | 0.679 |
| housing_type | 0.651 |
| age | 0.501 |
| household_size | 0.365 |
| landslide_level | 0.266 |
| flood_level | 0.264 |
| has_children_0_18 | 0.235 |
| has_pwd | 0.233 |
| is_solo_parent | 0.098 |
| storm_surge_level | 0.090 |
| monthly_income | 0.059 |

### Worked examples (one per predicted tier)
| Predicted | Household | Confidence | Top factors (contribution) |
|---|---|---|---|
| low | 3 people, ₱51,300/mo, self_employed, rented, crisis: none | 96% | housing_type (+0.16); has_children_0_18 (+0.14); monthly_income (+0.01) |
| moderate | 7 people, ₱24,100/mo, self_employed, owned, crisis: none | 81% | household_size (+0.79); has_children_0_18 (+0.26); landslide_level (+0.25) |
| high | 5 people, ₱4,200/mo, displaced, owned, crisis: job_loss | 96% | per_capita_income (+1.38); employment_status (+0.86); crisis_type (+0.65) |
