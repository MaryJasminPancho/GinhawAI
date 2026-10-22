# GinhawAI vulnerability model: evaluation report

Generated 2026-10-22T15:36:26+00:00 by `python -m ml.train` (XGBoost 3.2.0, scikit-learn 1.9.1).

## Data
- 12,000 synthetic households from `ml/config.json` (seed 2026); no real citizen data.
- Distributions follow public statistics (PSA poverty thresholds, FIES income brackets, CBMS-style indicators); values marked VERIFY in the config must be checked against those sources.
- Reference labels: CBMS-style deprivation points with tier cut-offs, plus 5% label noise to mimic assessor disagreement. The weights stand in for social-worker judgement and are to be reviewed by the licensed social workers.
- The sample deliberately over-represents low-income households (the system's intended users): 36% are below the per-capita poverty threshold.
- Tier shares: low 27%, moderate 37%, high 36%.
- Split: 9,600 training / 2,400 held-out test (stratified).

## Model
scikit-learn `Pipeline`: one-hot encoding of work situation, housing and crisis; numeric and yes/no answers passed through; `XGBClassifier` (3 classes, softprob).
Hyper-parameters chosen by 5-fold stratified cross-validation on Cohen's Kappa: {'learning_rate': 0.1, 'max_depth': 3, 'n_estimators': 300}.

## Results (held-out test set)
| Metric | XGBoost | 5-fold CV (mean ± sd) |
|---|---|---|
| Accuracy | 88.1% | 90.2% ± 0.3% |
| Cohen's Kappa | 0.820 | 0.852 ± 0.005 |
| Macro F1 | 0.884 | 0.905 ± 0.003 |

Target from the manuscript: Kappa ≥ 0.6 → the model **meets** it on the synthetic test set.

**Important:** this measures agreement with the synthetic reference labels. The manuscript's validity test is the Blind Cross-Validation against 3–5 licensed social workers on 30–50 cases (admin console → Blind Validation); report that Kappa as the main result.

### Confusion matrix (rows = reference tier, columns = predicted)
|  | pred. low | pred. moderate | pred. high |
|---|---|---|---|
| **low** | 585 | 61 | 3 |
| **moderate** | 56 | 744 | 85 |
| **high** | 1 | 79 | 786 |

### Per tier
| Tier | Precision | Recall | F1 | Cases |
|---|---|---|---|---|
| low | 0.911 | 0.901 | 0.906 | 649 |
| moderate | 0.842 | 0.841 | 0.841 | 885 |
| high | 0.899 | 0.908 | 0.903 | 866 |

### Compared with the previous rule-based score (same test set)
|  | Accuracy | Cohen's Kappa |
|---|---|---|
| Rule-based placeholder | 55.0% | 0.343 |
| XGBoost | 88.1% | 0.820 |

## Explainability
Each citizen's top three factors come from XGBoost's built-in **exact Tree SHAP** contributions (`pred_contribs=True`) toward the high-risk class, summed per answer and turned into plain-language sentences in Filipino, Bisaya or English.

### What matters most overall (mean absolute contribution to the high-risk score)
| Answer | Mean absolute contribution |
|---|---|
| per_capita_income | 1.720 |
| crisis_type | 0.746 |
| housing_type | 0.638 |
| employment_status | 0.608 |
| has_senior_member | 0.488 |
| household_size | 0.415 |
| landslide_level | 0.256 |
| has_children_0_18 | 0.240 |
| has_pwd | 0.235 |
| flood_level | 0.223 |
| is_solo_parent | 0.124 |
| storm_surge_level | 0.090 |
| monthly_income | 0.061 |
| age | 0.038 |

### Worked examples (one per predicted tier)
| Predicted | Household | Confidence | Top factors (contribution) |
|---|---|---|---|
| low | 3 people, ₱35,500/mo, employed, owned, crisis: medical | 65% | crisis_type (+1.24); has_children_0_18 (+0.11) |
| moderate | 2 people, ₱45,800/mo, employed, owned, crisis: none | 67% | has_pwd (+0.95); landslide_level (+0.60); has_senior_member (+0.37) |
| high | 10 people, ₱15,900/mo, underemployed, owned, crisis: none | 95% | per_capita_income (+2.04); household_size (+0.88); flood_level (+0.53) |
