"""
Impact estimate model.

Honesty constraint from the spec: this is a *pattern-based* estimate,
not a controlled experiment. No dataset of actual intervention
rollouts + before/after outcomes exists here, so "historical pattern
comparison" is operationalized as:

  For each cause, look across all state-years in the dataset at the
  correlation between a *fall* in that cause's share of accidents and
  a *fall* in the state's overall accident count the same year. A
  cause whose decline tends to coincide with fewer accidents gets a
  pattern_adjustment_factor > 1 applied to the literature baseline
  impact; a cause with a weak/inverse relationship gets a factor < 1.
  The factor is clamped to [0.7, 1.3] so it nudges, rather than
  overrides, the literature baseline.

This is explicitly cross-sectional/correlational and is labeled as
such in every response, per the spec's instruction to "be honest ...
that this is pattern-based, not a controlled experiment."
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.data.reference import INTERVENTION_CATALOG
from app.models.interventions import recommend_interventions


def _pattern_adjustment_factors(causes_df: pd.DataFrame, accidents_df: pd.DataFrame) -> dict:
    causes_sorted = causes_df.sort_values(["state", "cause", "year"]).copy()
    causes_sorted["share_delta"] = causes_sorted.groupby(["state", "cause"])["share"].diff()

    acc_sorted = accidents_df.sort_values(["state", "year"]).copy()
    acc_sorted["accidents_pct_change"] = (
        acc_sorted.groupby("state")["accidents"].pct_change() * 100
    )

    merged = causes_sorted.merge(
        acc_sorted[["state", "year", "accidents_pct_change"]],
        on=["state", "year"],
        how="inner",
    ).dropna(subset=["share_delta", "accidents_pct_change"])

    factors = {}
    for cause, grp in merged.groupby("cause"):
        if len(grp) < 5 or grp["share_delta"].std() < 1e-9:
            factors[cause] = 1.0
            continue
        corr = grp["share_delta"].corr(grp["accidents_pct_change"])
        if pd.isna(corr):
            corr = 0.0
        # positive corr => cause share falling alongside accidents falling
        # (supports the countermeasure narrative) => amplify baseline
        factor = 1.0 + 0.3 * float(np.clip(corr, -1, 1))
        factors[cause] = float(np.clip(factor, 0.7, 1.3))
    return factors


def impact_estimate(
    causes_df: pd.DataFrame, accidents_df: pd.DataFrame, state: str, year: int | None = None
) -> dict:
    rec = recommend_interventions(causes_df, state, year, top_n=5)

    state_year = year or int(accidents_df[accidents_df["state"] == state]["year"].max())
    state_row = accidents_df[
        (accidents_df["state"] == state) & (accidents_df["year"] == state_year)
    ]
    if state_row.empty:
        raise ValueError(f"No accident data for state '{state}' in {state_year}")

    total_accidents = float(state_row["accidents"].iloc[0])
    total_fatalities = float(state_row["fatalities"].iloc[0])
    fatality_rate = total_fatalities / total_accidents if total_accidents else 0.0

    factors = _pattern_adjustment_factors(causes_df, accidents_df)

    results = []
    for item in rec["recommendations"]:
        cause = item["cause_addressed"]
        pattern_factor = factors.get(cause, 1.0)
        adjusted_impact_pct = round(item["baseline_expected_impact_pct"] * pattern_factor, 1)

        cause_linked_accidents = total_accidents * item["cause_share_pct"] / 100
        prevented_accidents = cause_linked_accidents * adjusted_impact_pct / 100
        lives_saved = prevented_accidents * fatality_rate

        results.append({
            "intervention": item["intervention"],
            "cause_addressed": cause,
            "baseline_expected_impact_pct": item["baseline_expected_impact_pct"],
            "pattern_adjustment_factor": round(pattern_factor, 2),
            "adjusted_expected_impact_pct": adjusted_impact_pct,
            "estimated_accidents_prevented_per_year": round(prevented_accidents),
            "estimated_lives_saved_per_year": round(lives_saved, 1),
            "reference_cost_lakhs_per_unit": item["reference_cost_lakhs_per_unit"],
            "unit_description": item["unit_description"],
        })

    results.sort(key=lambda r: r["estimated_lives_saved_per_year"], reverse=True)

    return {
        "state": state,
        "year": state_year,
        "disclosure": "Impact percentages are pattern-based: a literature-informed baseline effectiveness per countermeasure, adjusted by a cross-sectional correlation (across all states/years in the dataset) between falling cause-share and falling accident counts. This is NOT a controlled experiment or causal estimate — treat as directional prioritization guidance.",
        "greatest_benefit_intervention": results[0]["intervention"] if results else None,
        "estimates": results,
    }
