# SafetyROI — Backend

Road Safety Intelligence System API for Problem Statement 3 (Transport:
RoadSafe India). FastAPI + pandas + scikit-learn, serving JSON and
HTMX-ready HTML fragments.

## Quickstart

```bash
python -m venv .venv && source .venv/bin/activate      # optional but recommended
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then open `http://localhost:8000/docs` for interactive Swagger docs, or
`http://localhost:8000/` for a health check.

Seed data is generated automatically into `data_files/*.csv` on first
run (see "Data" below) — no manual setup step needed.

## Project layout

```
app/
  data/
    reference.py       # static reference tables (states, population,
                        # cause/mode/age taxonomies, cause->intervention
                        # knowledge base + cost table, city coordinates)
    seed_generator.py  # generates synthetic seed CSVs matching the
                        # real MoRTH/NCRB/data.gov.in schema
    ingestion.py        # cleaning + standardization + merge/validation
    store.py            # in-memory pandas store, loaded at startup
  models/
    risk_scoring.py     # 0-100 risk score, explainable weighted formula
    forecasting.py      # linear regression / moving-average forecast
    causes.py            # cause breakdown for a state
    interventions.py    # cause -> intervention recommendation + ranking
    impact.py            # pattern-based impact estimate per intervention
    allocation.py        # budget-constrained greedy allocator (flagship)
    vulnerability.py    # mode-of-transport + age-band breakdown
    seasonal.py          # month/season risk flags
    mapping.py            # Plotly choropleth (+ bar-chart fallback)
  api/
    routes_*.py          # FastAPI routers, one per feature area
    render.py             # Jinja2 HTML-fragment rendering for HTMX
  templates/             # plain semantic HTML fragments (unstyled —
                          # frontend owns visual design)
  schemas.py              # Pydantic request models
  main.py                  # app assembly, CORS, startup data load
data_files/               # generated seed CSVs (see schema below)
requirements.txt
```

## API reference

All endpoints accept `?format=html` to receive an HTMX-swappable HTML
fragment instead of JSON (default `format=json`).

| Endpoint | Method | Notes |
|---|---|---|
| `/api/risk-scores` | GET | `?year=` optional. 0-100 score per state + reasoning + formula/weights. |
| `/api/risk-map` | GET | `?year=&include_city_markers=&top_n_cities=`. Returns embeddable Plotly HTML. |
| `/api/causes/{state}` | GET | `?year=` optional. Cause breakdown, ranked. |
| `/api/forecast/{state}` | GET | `?horizon=1..5`. Linear-regression accident forecast with R². |
| `/api/interventions/{state}` | GET | `?year=&top_n=`. Ranked intervention recommendations. |
| `/api/impact-estimate/{state}` | GET | `?year=`. Pattern-based impact % + lives-saved estimate per intervention. |
| `/api/allocate-budget` | POST | Body: `{total_budget_lakhs, states?, year?}`. **Flagship** — cross-state greedy allocation by lives-saved-per-rupee. |
| `/api/vulnerability/{state}` | GET | `?year=`. Mode-of-transport + age-band breakdown. |
| `/api/seasonal-risk/{state}` | GET | Month-level relative risk index + high-risk-month flags. |
| `/api/meta/states` | GET | List of covered states + available years. |
| `/api/meta/summary` | GET | National headline stats for the landing page. |

Every risk/score endpoint includes a `reasoning` or `methodology` /
`disclosure` field explaining *why* the number is what it is — this is
intentional per the "intelligence system, not a stats API" framing in
the problem statement, and per the requirement to be explicit that
impact estimates are pattern-based, not causal.

## Data

**No real dataset file was supplied with this build**, so
`seed_generator.py` produces internally-consistent synthetic data
shaped like the real sources (state/UT + year accident/fatality/injury
counts with a COVID-19 dip in 2020, cause-wise shares, mode-of-transport
shares, age-band shares, city-level series, and a seasonal index) with
a fixed random seed for reproducibility.

**To use real data**, drop CSVs into `data_files/` with these exact
filenames/columns and the ingestion pipeline will pick them up in
place of the generated seed (delete the seed CSV first if it already
exists, since ingestion only generates when the file is missing):

| File | Columns |
|---|---|
| `accidents_state_year.csv` | `state, year, accidents, fatalities, injuries, population_lakhs` |
| `causes_state_year.csv` | `state, year, cause, share` (cause names must match `reference.CAUSES`, shares should sum to ~1 per state-year) |
| `modes_state_year.csv` | `state, year, mode, share` (mode names must match `reference.MODES_OF_TRANSPORT`) |
| `vulnerability_age_state_year.csv` | `state, year, age_band, share` (bands must match `reference.AGE_BANDS`) |
| `accidents_city_year.csv` | `city, state, year, accidents, fatalities` |
| `seasonal_state_month.csv` | `state, month, relative_risk_index` |

`ingestion.py` standardizes state-name variants (Orissa→Odisha,
Pondicherry→Puducherry, J&K→Jammu and Kashmir, etc.) and re-normalizes
cause shares if they drift from summing to 1.

## Design notes / honesty disclosures baked into the API

- **Risk score** is a transparent weighted formula (40% accident rate,
  40% fatality rate, 20% YoY trend), min-max normalized across states
  for the selected year. Weights are returned in every response.
- **Forecast** is deliberately simple (OLS linear regression, falling
  back to a flat forecast under 3 data points) per the spec's
  "don't overfit" instruction — R² and slope are always returned.
- **Impact estimate** is explicitly labeled pattern-based /
  correlational (a literature-informed baseline effectiveness per
  countermeasure type, nudged by a cross-sectional correlation found in
  this dataset) — never presented as a causal, experimentally-verified
  number.
- **Budget allocation** is a greedy 0/1 knapsack by lives-saved-per-rupee
  — fast and auditable, explicitly not claimed to be globally optimal.
- **Risk map** falls back to a ranked bar chart if an India state
  GeoJSON can't be loaded (no bundled file, tries a public URL, then
  falls back) so the endpoint never hard-fails offline.

## Running tests / sanity checks

```bash
python -m app.data.seed_generator     # regenerate seed CSVs
python -c "from app.data.ingestion import load_all; print({k: v.shape for k, v in load_all().items()})"
```
