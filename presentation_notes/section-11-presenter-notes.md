# Section 11 — Solutions: Data Cleaning & Imputation
### Presenter preparation notes · UEP REMA

---

## Structure overview

| Slide | Topic | Type |
|---|---|---|
| Intro | Section title | Dark chapter intro |
| C1 | Audit missing values | Task |
| C2 | Cast column types | 🐛 Bug 1 |
| C3 | *(fix)* | ✓ Fix 1 |
| C4 | Decode `funkcjaLokalu` codes | Task |
| C5 | Detect & flag outliers | Task |
| C6 | IQR bounds on clipped data | 🐛 Bug 2 |
| C7 | *(fix)* | ✓ Fix 2 |
| I1 | Global vs grouped median | 🐛 Bug 3 |
| I2 | *(fix)* | ✓ Fix 3 |
| I3 | PMM — masks & data setup | Task |
| I4 | PMM — OLS & donor pool | Task |
| I5 | PMM ignores missing predictors | 🐛 Bug 4 |
| I6 | *(fix)* | ✓ Fix 4 |
| I7 | Stochastic regression | Task |
| I8 | Sigma from full column | 🐛 Bug 5 |
| I9 | *(fix)* | ✓ Fix 5 |
| I10 | Comparing three strategies | Task |
| I11 | Final inspection & export | Task |

Bug slides appear on a **dark red background** (`#2a0d06`). Each bug/fix pair is animated — only the changed line morphs between slides.

---

## DATA CLEANING

---

### C1 — Audit missing values (`msno`)

```python
msno.bar(df_lokale, figsize=(12, 4), color='steelblue')
plt.title('Non-null counts per column')
plt.tight_layout()
plt.show()

msno.matrix(df_lokale, figsize=(12, 5))
plt.title('Nullity matrix')
plt.tight_layout()
plt.show()

msno.heatmap(df_lokale, figsize=(8, 6))
plt.title('Missing-value correlation heatmap')
plt.tight_layout()
plt.show()
```

**What each plot tells you:**

- **`msno.bar`** — draws one bar per column. Height = fraction of non-null rows. Best for a quick headline: "which columns have gaps at all?" Columns with full bars can be ignored in imputation planning.

- **`msno.matrix`** — draws a row×column grid, white = null. The key question is *pattern*: if nulls appear in solid horizontal bands, entire records are missing (e.g. all optional fields blank for certain transaction types). If nulls are scattered randomly, they're independent and can be imputed column by column.

- **`msno.heatmap`** — shows the Pearson correlation of the *nullity indicators* (0/1 vectors) between column pairs. A value near +1 means "when column A is missing, column B is also missing" — useful for deciding whether to impute them together using the same predictors.

**Talking point:** Run all three before deciding any imputation strategy. A single `.isnull().sum()` gives counts but misses structural patterns entirely.

---

### C2/C3 — Bug 1 · Cast column types · `int64` vs `Int64`

**Full correct solution (from solutions notebook):**

```python
COLUMN_TYPES = {
    'powUzytkowaLokalu':             'float64',
    'cenaLokaluBrutto':              'float64',
    'liczbaIzb':                     'Int64',
    'nrKondygnacji':                 'Int64',
    'funkcjaLokalu':                 'Int64',
    'powUzytkowaPomieszczenPrzynal': 'float64',
    'kwotaPodatkuVAT':               'float64',
    'dodatkoweInformacje':           'str',
}

df = df_lokale.copy()

for col, dtype in COLUMN_TYPES.items():
    if col not in df.columns:
        continue
    if dtype in ('float64', 'Int64'):
        df[col] = pd.to_numeric(df[col], errors='coerce')
        if dtype == 'Int64':
            df[col] = df[col].astype('Int64')   # ← correct
    else:
        df[col] = df[col].where(df[col].notna(), other=pd.NA).astype(dtype)
```

**The bug (slide C2):**
```python
df[col] = df[col].astype('int64')   # ← BUG (lowercase)
```

**Why it crashes:**
NumPy's `int64` is a C-backed integer with no sentinel value for "missing". When the column contains `NaN` (a float), pandas cannot fit it into `int64` and raises `ValueError: Cannot convert non-finite values (NA or inf) to integer`. This happens because `pd.to_numeric(errors='coerce')` converts unparsable strings to `NaN` — so by the time we cast, NaNs are already present.

**The fix (slide C3):**
```python
df[col] = df[col].astype('Int64')   # ← FIXED (capital I)
```

Pandas' nullable `Int64` (introduced in pandas 1.0) stores missing values as `pd.NA` instead of `NaN`. The dtype is backed by an object + boolean mask internally, not a raw C integer, so it can represent both integer values and absence.

**Rule of thumb:** Any integer column that may have missing values → use `Int64`. Any float column → `float64` is fine because `float` has `NaN` built in (IEEE 754).

**Line-number focus on slides:** Line 5 of the 5-line loop (the `astype` call).

---

### C4 — Decode `funkcjaLokalu` codes

```python
FUNKCJA_LABELS = {
    1: 'mieszkalna',
    2: 'użytkowa',
    3: 'mieszkalno-użytkowa',
    4: 'rekreacji indywidualnej',
    5: 'zbiorowego zamieszkania',
    6: 'garażowa',
    7: 'inne',
}

df['funkcjaLokalu_label'] = df['funkcjaLokalu'].map(FUNKCJA_LABELS).fillna('nieznana')
```

**Line-by-line:**

- `FUNKCJA_LABELS` — a plain dict mapping the integer codes (as they appear in the GML) to human-readable Polish labels. The mapping is defined in the RCN data specification.

- `.map(FUNKCJA_LABELS)` — vectorised lookup: for each row, pandas replaces the integer with the corresponding string. It does **not** loop in Python — it's implemented in C. Any code not in the dict returns `NaN`.

- `.fillna('nieznana')` — catches any future code that wasn't in the spec at the time of writing. Without this, unmapped codes silently stay `NaN` and disappear from value-count plots.

**Why this matters downstream:** The `funkcjaLokalu_label` column is used as the grouping key in Bug 3 / Fix 3 (median imputation). Without readable labels it's impossible to sanity-check whether "garages" are getting garage-appropriate imputed values.

---

### C5 — Detect & flag outliers (IQR method)

```python
def iqr_bounds(series, factor=3.0):
    q1, q3 = series.quantile([0.25, 0.75])
    iqr = q3 - q1
    return q1 - factor * iqr, q3 + factor * iqr

price_lo, price_hi = iqr_bounds(df['cenaLokaluBrutto'].dropna())
area_lo,  area_hi  = iqr_bounds(df['powUzytkowaLokalu'].dropna())

df['is_outlier'] = (
    (df['cenaLokaluBrutto'] < price_lo) | (df['cenaLokaluBrutto'] > price_hi) |
    (df['powUzytkowaLokalu'] < area_lo)  | (df['powUzytkowaLokalu'] > area_hi)
)
```

**Line-by-line:**

- `series.quantile([0.25, 0.75])` — returns Q1 and Q3 in one call (pandas accepts a list).
- `iqr = q3 - q1` — the interquartile range, the middle 50% of the distribution.
- `q1 - factor * iqr` / `q3 + factor * iqr` — Tukey fences. Factor = 1.5 is the classic "mild outlier" definition; **factor = 3.0 is the "extreme outlier"** definition — much more lenient, keeps more data.
- `.dropna()` before passing to `iqr_bounds` — NaN would propagate into quantile calculations and return NaN bounds. Remove them first, compute on real values only.
- `df['is_outlier']` — a boolean flag column. We **do not drop** outlier rows; we flag them so they can be inspected, reported, or excluded selectively in downstream analysis.

**Slide progression:** Line highlight steps: function definition → call with `.dropna()` → boolean flag assignment.

---

### C6/C7 — Bug 2 · IQR bounds on clipped data

**The bug (slide C6):**
```python
price_lo, price_hi = iqr_bounds(clip_series(df['cenaLokaluBrutto']))
area_lo,  area_hi  = iqr_bounds(clip_series(df['powUzytkowaLokalu']))
```

`clip_series` was defined earlier for plotting:
```python
def clip_series(s, lo=0.01, hi=0.99):
    s = s.dropna()
    return s.clip(s.quantile(lo), s.quantile(hi))
```

It truncates values at the 1st and 99th percentile. This is correct for a histogram — it removes extreme visual outliers so the plot is readable. But feeding this clipped series into `iqr_bounds` **compresses** the IQR artificially:

- Original Q3 of `cenaLokaluBrutto` might be 800,000 PLN
- Clipped Q3 might be 600,000 PLN (because the top 1% of prices were cut)
- Smaller IQR → tighter `price_hi` bound → many legitimate expensive apartments are suddenly flagged as outliers

**The fix (slide C7):**
```python
price_lo, price_hi = iqr_bounds(df['cenaLokaluBrutto'].dropna())
area_lo,  area_hi  = iqr_bounds(df['powUzytkowaLokalu'].dropna())
```

**General rule:** Visualisation transformations (clipping, log scaling, binning) exist to make charts readable. They must never feed back into statistical computations. Always compute statistics from the original data.

---

## DATA IMPUTATION

---

### I1/I2 — Bug 3 · Global vs grouped median

**The bug (slide I1):**
```python
df_bug3 = df.copy()
for col in IMPUTE_COLS:
    df_bug3[col] = df_bug3[col].fillna(df_bug3[col].median())  # global median
```

`df_bug3[col].median()` computes a single number across all ~1000+ rows — residential apartments, commercial units, garages, recreational properties all mixed together. The median price of this entire pool is dominated numerically by whichever type is most common, which is likely residential. A garage missing its price then gets imputed with the residential apartment median — wrong by an order of magnitude.

**The fix (slide I2):**
```python
df_median = df.copy()
for col in IMPUTE_COLS:
    group_median = df_median.groupby('funkcjaLokalu')[col].transform('median')
    df_median[col] = df_median[col].fillna(group_median)
```

**Why `.transform('median')` not `.groupby().median()`:**

- `.groupby('funkcjaLokalu')[col].median()` returns a **small Series** indexed by `funkcjaLokalu` values (7 rows): `{1: 450000, 2: 900000, ...}`. You cannot pass this directly to `.fillna()` because the index doesn't align with the DataFrame's row index.

- `.groupby('funkcjaLokalu')[col].transform('median')` returns a **full-length Series** with the same index as `df` — each row contains the median of its own group. This aligns perfectly with `.fillna()`.

**Talking point:** This is a classic pandas gotcha. Ask: "why doesn't `.groupby().median()` work here?" Let the group discover the index mismatch.

---

### I3 — PMM — masks & data setup

```python
def pmm_impute(df, target_col, predictors, k=5, random_state=42):
    rng   = np.random.default_rng(random_state)
    preds = [p for p in predictors if p != target_col and p in df.columns]

    mask_obs  = df[target_col].notna() & df[preds].notna().all(axis=1)
    mask_miss = df[target_col].isna()  & df[preds].notna().all(axis=1)

    X_obs  = df.loc[mask_obs,  preds].values.astype(float)
    y_obs  = df.loc[mask_obs,  target_col].values.astype(float)
    X_miss = df.loc[mask_miss, preds].values.astype(float)
```

**Line-by-line:**

- `np.random.default_rng(random_state)` — creates a reproducible random number generator (NumPy's modern API, preferred over `np.random.seed()`).

- `preds = [p for p in predictors ...]` — defensive filter: removes `target_col` from predictors if accidentally included, and drops any column not present in the DataFrame. Prevents KeyError.

- `mask_obs` — boolean array: True for rows where **both** target and **all** predictors are non-null. These are the training rows for OLS.

- `mask_miss` — boolean array: True for rows where target is NaN **and all** predictors are non-null. These are the rows that will be imputed. The predictor check is critical — see Bug 4.

- `X_obs`, `y_obs`, `X_miss` — NumPy arrays extracted with `.values.astype(float)`. The `.values` drops the pandas index; `.astype(float)` ensures no object dtype survives into the linear algebra.

---

### I4 — PMM — OLS & donor pool

```python
    X_obs_a  = np.column_stack([np.ones(len(X_obs)),  X_obs])
    X_miss_a = np.column_stack([np.ones(len(X_miss)), X_miss])

    beta       = np.linalg.lstsq(X_obs_a, y_obs, rcond=None)[0]
    y_hat_obs  = X_obs_a  @ beta
    y_hat_miss = X_miss_a @ beta

    donors  = [y_obs[np.argsort(np.abs(y_hat_obs - p))[:k]] for p in y_hat_miss]
    imputed = np.array([rng.choice(d) for d in donors])
    df.loc[mask_miss, target_col] = imputed
```

**Line-by-line:**

- `np.column_stack([np.ones(...), X_obs])` — prepends a column of 1s. This is the standard design matrix trick: the OLS intercept is absorbed into the coefficient of the ones column. Without it, the regression is forced through the origin.

- `np.linalg.lstsq(X_obs_a, y_obs, rcond=None)[0]` — solves the OLS normal equations using QR decomposition. Returns `[beta, residuals, rank, singular_values]`; `[0]` takes only the coefficients. `rcond=None` suppresses a deprecation warning.

- `y_hat_obs = X_obs_a @ beta` — predicted values for **observed** rows. Used only to find donors.
- `y_hat_miss = X_miss_a @ beta` — predicted values for **missing** rows. Used to find the donor pool.

- **Donor pool construction:**
  ```python
  donors = [y_obs[np.argsort(np.abs(y_hat_obs - p))[:k]] for p in y_hat_miss]
  ```
  For each missing row's predicted value `p`, compute `|y_hat_obs - p|` (distance of each observed row's prediction from `p`), sort ascending with `argsort`, take the top `k` indices, index into `y_obs` to get their **actual** values. This is the donor pool.

- `rng.choice(d)` — randomly pick one actual observed value from the donor pool. Randomness is essential: without it, every missing row with the same prediction would get the same imputed value, creating artificial ties.

- `df.loc[mask_miss, target_col] = imputed` — write back to the DataFrame using the boolean mask. Only rows where target was NaN are modified.

**Why PMM is better than plain regression imputation:** Regression would impute `y_hat_miss` directly — a smooth model prediction. PMM imputes a real observed value close to that prediction. This means imputed values are guaranteed to be in the range of actually observed data, which is especially important for bounded quantities (price, area cannot be negative).

---

### I5/I6 — Bug 4 · PMM ignores missing predictors

**The bug (slide I5):**
```python
mask_obs  = df[target_col].notna() & df[preds].notna().all(axis=1)
mask_miss = df[target_col].isna()   # BUG: doesn't check predictors
```

**What happens:**
- A row where `target_col` is NaN **and** a predictor is also NaN passes into `X_miss`.
- `X_miss` has a `NaN` in it.
- `X_miss_a @ beta` produces `NaN` for that row (any arithmetic with NaN propagates NaN).
- `df.loc[mask_miss, target_col] = imputed` writes `NaN` back to the DataFrame.
- The cell now contains `NaN`, but it is no longer `pd.NA` — it is a float `NaN`.
- `.isnull().sum()` **still reports it as null**, but it looks imputed from the outside because the boolean mask was satisfied. This is silent data corruption.

**The fix (slide I6):**
```python
mask_miss = df[target_col].isna()  & df[preds].notna().all(axis=1)  # FIXED
```

Rows where both target and a predictor are missing are simply **skipped** — they stay NaN. This is honest: PMM cannot help them. A separate fallback (e.g. global median) can handle them in a second pass.

---

### I7 — Stochastic Regression Imputation

```python
beta      = np.linalg.lstsq(X_obs_a, y_obs, rcond=None)[0]
residuals = y_obs - X_obs_a @ beta
sigma     = np.std(residuals)                        # residual σ

y_pred = X_miss_a @ beta + rng.normal(0, sigma, size=len(X_miss))
```

**Line-by-line:**

- `beta = np.linalg.lstsq(...)` — same OLS fit as PMM. Finds the linear relationship in the observed rows.

- `residuals = y_obs - X_obs_a @ beta` — the model's errors on the training data. Each residual is the vertical distance between the actual value and the regression line.

- `sigma = np.std(residuals)` — standard deviation of residuals. This measures how wide the scatter is **after accounting for the linear trend**. It is always smaller than the full-column standard deviation.

- `y_pred = X_miss_a @ beta + rng.normal(0, sigma, size=len(X_miss))` — deterministic prediction (`X_miss_a @ beta`) plus random noise drawn from a normal distribution with mean 0 and standard deviation `sigma`. Each missing row gets a different noise draw.

**Why add noise?** Plain regression imputes the **conditional mean** — the value the model predicts given the predictors. If you impute many rows this way, they all cluster tightly around the regression line. The resulting column has far less variance than the original. Adding residual-scale noise restores the original spread, which is critical if you later compute standard deviations, confidence intervals, or run simulations.

---

### I8/I9 — Bug 5 · Sigma from full column

**The bug (slide I8):**
```python
residuals = y_obs - X_obs_a @ beta
sigma     = np.std(df[target_col].dropna())   # BUG: full-column std
y_pred    = X_miss_a @ beta + rng.normal(0, sigma, size=len(X_miss))
```

**Why this is wrong:**
`np.std(df[target_col].dropna())` computes the standard deviation of **all observed prices** — the full spread from the cheapest garage to the most expensive penthouse. This includes:
- Variation explained by `funkcjaLokalu`, `powUzytkowaLokalu`, etc. (the model's job)
- Residual variation (what is left over)

The residual std is only the *unexplained* part. The full-column std can easily be 5–10× larger.

**Result:** the noise term `rng.normal(0, sigma_bug, ...)` adds enormous random swings to each prediction, producing imputed apartment prices that might be negative or 10× the actual market range.

**The fix (slide I9):**
```python
sigma = np.std(residuals)   # residual std only
```

**Analogy for explanation:** Imagine predicting student exam scores from hours studied. The full-column std of scores might be 20 points. But after fitting "score = 40 + 5 × hours", the residuals (how far each student's actual score was from their personal prediction) might have std = 5 points. The right noise to add to a new prediction is 5 points, not 20.

---

### I10 — Comparing three strategies

| Method | How it works | Preserves variance? | Risk |
|---|---|---|---|
| **Mediana grupowana** | Per-category median fill | No — creates spikes at the median | Bimodal histograms if groups differ strongly |
| **PMM** | Nearest-predicted-value donor | Yes — borrows real observed values | Needs enough observed neighbours; slow for large k |
| **Regresja stochastyczna** | Regression + residual noise | Yes — adds Gaussian noise | Parametric assumption (linearity); needs non-null predictors |

**Key decision factor:** If the scientific question requires correct variance (e.g. computing confidence intervals, running bootstrap simulations), use PMM or stochastic regression. If you just need a filled column for a prediction model, grouped median is fast and usually good enough.

---

### I11 — Final inspection & export

```python
msno.bar(df_clean, figsize=(12, 4), color='seagreen')
plt.title('Null counts after cleaning')
plt.tight_layout()
plt.show()

df_median.to_csv('../data/lokale_median.csv', index=False)
df_pmm.to_csv('../data/lokale_pmm.csv', index=False)
df_stochastic.to_csv('../data/lokale_stochastic.csv', index=False)
df_clean.to_csv('../data/lokale_clean.csv', index=False)
```

**Line-by-line:**

- Re-running `msno.bar` on the cleaned DataFrame is a **sanity check**: every bar should reach 100% for the imputed columns. If any bar is still short, imputation was incomplete (e.g. rows where all predictors were also NaN — the PMM fallthrough case).

- `index=False` — without this, pandas writes the DataFrame's integer row index as an extra unnamed first column. This is almost always unwanted and confuses downstream readers.

- Four separate CSV files — one per method. This lets students compare downstream in the next session: load all four, run the same regression model, compare coefficients and R² to see how imputation strategy affects analysis.

---

## All 5 bugs — cheat sheet

| # | Slide | Bug | Fix |
|---|---|---|---|
| 1 | C2→C3 | `.astype('int64')` crashes with NaN | `.astype('Int64')` (pandas nullable) |
| 2 | C6→C7 | `iqr_bounds(clip_series(...))` → over-tight bounds | `iqr_bounds(df[col].dropna())` on raw data |
| 3 | I1→I2 | `.fillna(col.median())` → global median | `.groupby(...).transform('median')` per category |
| 4 | I5→I6 | `mask_miss = target.isna()` only | add `& df[preds].notna().all(axis=1)` |
| 5 | I8→I9 | `sigma = np.std(full_column)` → noise too large | `sigma = np.std(residuals)` |

---

## Questions to pose during presentation

- **After C1:** "Looking at the matrix plot — do you see any rows where all optional columns are blank at once?"
- **After C2:** "Why does `int64` crash but `float64` doesn't? What's special about floating-point NaN?"
- **After C5:** "Why do we flag outliers instead of dropping them?"
- **After I1:** "What would the global median price of a garage be vs. its grouped median? How far off would imputation be?"
- **After I3:** "Why do both `mask_obs` and `mask_miss` filter on predictor availability?"
- **After I7:** "What happens to the histogram of an imputed column if you skip the noise term?"
- **After I10:** "Which method would you use if the next step is feeding the data into a linear regression? Into a neural network?"
