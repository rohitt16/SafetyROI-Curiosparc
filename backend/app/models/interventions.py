"""
Intervention recommendation.

Maps a state's top causes to interventions via the cause -> intervention
knowledge base in `reference.py`, ranked by (cause share * baseline
literature-informed impact), so the recommendation reflects both how
common the cause is in that state and how effective the countermeasure
is expected to be.
"""

from __future__ import annotations

import pandas as pd

from app.data.reference import INTERVENTION_CATALOG
from app.models.causes import cause_breakdown


def recommend_interventions(
    causes_df: pd.DataFrame, state: str, year: int | None = None, top_n: int = 3
) -> dict:
    breakdown = cause_breakdown(causes_df, state, year)

    scored = []
    for item in breakdown["breakdown"]:
        cause = item["cause"]
        catalog_entry = INTERVENTION_CATALOG.get(cause)
        if not catalog_entry:
            continue
        priority_score = round(item["share_pct"] * catalog_entry["baseline_impact_pct"] / 100, 2)
        scored.append({
            "cause_addressed": cause,
            "cause_share_pct": item["share_pct"],
            "intervention": catalog_entry["intervention"],
            "baseline_expected_impact_pct": catalog_entry["baseline_impact_pct"],
            "priority_score": priority_score,
            "unit_description": catalog_entry["unit_description"],
            "reference_cost_lakhs_per_unit": catalog_entry["cost_per_unit_lakhs"],
        })

    scored.sort(key=lambda r: r["priority_score"], reverse=True)
    top = scored[:max(top_n, 3)]

    return {
        "state": state,
        "year": breakdown["year"],
        "methodology": "Interventions are drawn from a cause->countermeasure knowledge base, ranked by priority_score = (share of accidents attributed to the cause in this state) x (literature-informed baseline effectiveness of the matched countermeasure).",
        "recommendations": top,
    }
