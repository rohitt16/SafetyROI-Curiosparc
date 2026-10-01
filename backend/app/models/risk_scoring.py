"""
Risk scoring model.

score = 100 * (
    w_accident_rate * norm(accidents per lakh population)
  + w_fatality_rate * norm(fatalities per accident)
  + w_trend        * norm(YoY % change in accidents)
)

All three components are min-max normalized across the current set of
states for the *latest available year* before weighting, so the score
is always relative to the current national picture (0 = safest,
100 = highest risk, among the states covered). Weights are returned in
every response for explainability, per the API spec.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.data.reference import RISK_WEIGHTS


def _minmax(series: pd.Series) -> pd.Series:
    lo, hi = series.min(), series.max()
    if hi - lo < 1e-9:
        return pd.Series(0.5, index=series.index)
    return (series - lo) / (hi - lo)


def compute_state_year_metrics(accidents_df: pd.DataFrame) -> pd.DataFrame:
    """Adds accident_rate (per lakh population) and fatality_rate
    (fatalities per accident) columns, plus YoY % trend per state."""
    df = accidents_df.copy().sort_values(["state", "year"])
    df["accident_rate"] = df["accidents"] / df["population_lakhs"]
    df["fatality_rate"] = df["fatalities"] / df["accidents"].replace(0, np.nan)
    df["fatality_rate"] = df["fatality_rate"].fillna(0)

    df["prev_accidents"] = df.groupby("state")["accidents"].shift(1)
    df["yoy_pct_change"] = (
        (df["accidents"] - df["prev_accidents"]) / df["prev_accidents"].replace(0, np.nan)
    ) * 100
    df["yoy_pct_change"] = df["yoy_pct_change"].fillna(0)
    return df


def compute_risk_scores(accidents_df: pd.DataFrame, year: int | None = None) -> pd.DataFrame:
    """Returns one row per state with a 0-100 risk score for the
    requested year (defaults to the latest year in the data), plus the
    normalized component scores and raw metrics for explainability."""
    metrics = compute_state_year_metrics(accidents_df)

    target_year = year or int(metrics["year"].max())
    snapshot = metrics[metrics["year"] == target_year].copy()
    if snapshot.empty:
        raise ValueError(f"No data available for year {target_year}")

    snapshot["norm_accident_rate"] = _minmax(snapshot["accident_rate"])
    snapshot["norm_fatality_rate"] = _minmax(snapshot["fatality_rate"])
    snapshot["norm_trend"] = _minmax(snapshot["yoy_pct_change"])

    w = RISK_WEIGHTS
    snapshot["risk_score"] = 100 * (
        w["accident_rate"] * snapshot["norm_accident_rate"]
        + w["fatality_rate"] * snapshot["norm_fatality_rate"]
        + w["trend"] * snapshot["norm_trend"]
    )
    snapshot["risk_score"] = snapshot["risk_score"].round(1)
    snapshot["year"] = target_year

    def _top_factor(row):
        contributions = {
            "accident_rate": w["accident_rate"] * row["norm_accident_rate"],
            "fatality_rate": w["fatality_rate"] * row["norm_fatality_rate"],
            "trend": w["trend"] * row["norm_trend"],
        }
        ranked = sorted(contributions.items(), key=lambda kv: kv[1], reverse=True)
        return ranked

    snapshot["_ranked_factors"] = snapshot.apply(_top_factor, axis=1)

    cols = [
        "state", "year", "accidents", "fatalities", "accident_rate",
        "fatality_rate", "yoy_pct_change", "norm_accident_rate",
        "norm_fatality_rate", "norm_trend", "risk_score", "_ranked_factors",
    ]
    return snapshot[cols].sort_values("risk_score", ascending=False).reset_index(drop=True)


_FACTOR_LABELS = {
    "accident_rate": "Accident rate per lakh population",
    "fatality_rate": "Fatalities per accident (severity)",
    "trend": "Year-over-year accident growth",
}


def build_reasoning(ranked_factors: list[tuple[str, float]]) -> list[dict]:
    total = sum(v for _, v in ranked_factors) or 1e-9
    return [
        {
            "factor": _FACTOR_LABELS[key],
            "contribution_pct": round(100 * val / total, 1),
        }
        for key, val in ranked_factors
    ]


def risk_scores_payload(accidents_df: pd.DataFrame, year: int | None = None) -> dict:
    df = compute_risk_scores(accidents_df, year)
    results = []
    for _, row in df.iterrows():
        results.append({
            "state": row["state"],
            "year": int(row["year"]),
            "risk_score": float(row["risk_score"]),
            "metrics": {
                "accidents": int(row["accidents"]),
                "fatalities": int(row["fatalities"]),
                "accident_rate_per_lakh_pop": round(float(row["accident_rate"]), 2),
                "fatality_rate_per_accident": round(float(row["fatality_rate"]), 3),
                "yoy_pct_change": round(float(row["yoy_pct_change"]), 2),
            },
            "reasoning": build_reasoning(row["_ranked_factors"]),
        })
    return {
        "year": int(df["year"].iloc[0]) if not df.empty else year,
        "formula": {
            "description": "risk_score = 100 * (w1*norm(accident_rate) + w2*norm(fatality_rate) + w3*norm(yoy_trend)), min-max normalized across all covered states for the selected year",
            "weights": RISK_WEIGHTS,
        },
        "results": results,
    }
