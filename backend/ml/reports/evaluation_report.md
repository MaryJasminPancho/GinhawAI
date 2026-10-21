# GinhawAI vulnerability model: evaluation report

Generated 2026-10-21T17:19:43+00:00 by `python -m ml.train` (XGBoost 3.2.0, scikit-learn 1.9.1).

## Data
- 12,000 synthetic households from `ml/config.json` (seed 2026); no real citizen data.
- Distributions follow public statistics (PSA poverty thresholds, FIES income brackets, CBMS-style indicators); values marked VERIFY in the config must be checked against those sources.
- Reference labels: CBMS-style deprivation points with tier cut-offs, plus 5% label noise to mimic assessor disagreement. The weights stand in for social-worker judgement and are to be reviewed by the licensed social workers.
- The sample deliberately over-represents low-income households (the system's intended users): 36% are below the per-capita poverty threshold.
- Tier shares: low 37%, moderate 35%, high 29%.
- Split: 9,600 training / 2,400 held-out test (stratified).

## Model
scikit-learn `Pipeline`: one-hot encoding of work situation, housing and crisis; numeric and yes/no answers passed through; `XGBClassifier` (3 classes, softprob).
Hyper-parameters chosen by 5-fold stratified cross-validation on Cohen's Kappa: {'learning_rate': 0.1, 'max_depth': 3, 'n_estimators': 300}.

## Results (held-out test set)
| Metric | XGBoost | 5-fold CV (mean ± sd) |
|---|---|---|
| Accuracy | 91.7% | 91.4% ± 0.6% |
| Cohen's Kappa | 0.874 | 0.870 ± 0.009 |
| Macro F1 | 0.917 | 0.914 ± 0.006 |

Target from the manuscript: Kappa ≥ 0.6 → the model **meets** it on the synthetic test set.

**Important:** this measures agreement with the synthetic reference labels. The manuscript's validity test is the Blind Cross-Validation against 3–5 licensed social workers on 30–50 cases (admin console → Blind Validation); report that Kappa as the main result.

### Confusion matrix (rows = reference tier, columns = predicted)
|  | pred. low | pred. moderate | pred. high |
|---|---|---|---|
| **low** | 848 | 38 | 1 |
| **moderate** | 67 | 729 | 33 |
| **high** | 0 | 61 | 623 |

### Per tier
| Tier | Precision | Recall | F1 | Cases |
|---|---|---|---|---|
| low | 0.927 | 0.956 | 0.941 | 887 |
| moderate | 0.880 | 0.879 | 0.880 | 829 |
| high | 0.948 | 0.911 | 0.929 | 684 |

### Compared with the previous rule-based score (same test set)
|  | Accuracy | Cohen's Kappa |
|---|---|---|
| Rule-based placeholder | 65.9% | 0.476 |
| XGBoost | 91.7% | 0.874 |

## Explainability
Each citizen's top three factors come from XGBoost's built-in **exact Tree SHAP** contributions (`pred_contribs=True`) toward the high-risk class, summed per answer and turned into plain-language sentences in Filipino, Bisaya or English.

### What matters most overall (mean absolute contribution to the high-risk score)
| Answer | Mean absolute contribution |
|---|---|
| per_capita_income | 2.156 |
| employment_status | 0.917 |
| crisis_type | 0.894 |
| age | 0.523 |
| household_size | 0.521 |
| housing_type | 0.459 |
| has_children_0_18 | 0.348 |
| has_pwd | 0.279 |
| is_solo_parent | 0.143 |
| monthly_income | 0.096 |

### Worked examples (one per predicted tier)
| Predicted | Household | Confidence | Top factors (contribution) |
|---|---|---|---|
| low | 1 person, ₱5,700/mo, informal, owned, crisis: none | 93% | employment_status (+0.44); monthly_income (+0.23) |
| moderate | 3 people, ₱12,300/mo, underemployed, with_relatives, crisis: none | 64% | employment_status (+0.27); monthly_income (+0.04) |
| high | 4 people, ₱2,000/mo, unemployed, rented, crisis: none | 97% | per_capita_income (+1.53); employment_status (+1.48); age (+0.55) |
