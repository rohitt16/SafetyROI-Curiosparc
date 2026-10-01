"""
SafetyROI's flagship feature: budget-constrained intervention
prioritization across all states.

Builds one candidate per (state, recommended intervention), each with
an estimated cost (from the reference cost table) and estimated lives
saved per year (from the impact-estimate model), then greedily selects
candidates in descending order of lives-saved-per-rupee until the
budget is exhausted (a 0/1 greedy knapsack — simple and explainable,
per the same "don't overfit" spirit as the forecasting model; it is
not claimed to be the global optimum, just a strong, auditable
heuristic, which is disclosed in the response).
"""

from __future__ import annotations

import pandas as pd

from app.models.impact import impact_estimate
from app.data.reference import STATES


def _candidates_for_state(causes_df, accidents_df, state: str, year: int | None) -> list[dict]:
    try:
        est = impact_estimate(causes_df, accidents_df, state, year)
    except ValueError:
        return []

    candidates = []
    for item in est["estimates"]:
        cost_lakhs = item["reference_cost_lakhs_per_unit"]
        lives = item["estimated_lives_saved_per_year"]
        if cost_lakhs <= 0:
            continue
        candidates.append({
            "state": state,
            "intervention": item["intervention"],
            "cause_addressed": item["cause_addressed"],
            "estimated_cost_lakhs": cost_lakhs,
            "estimated_lives_saved_per_year": lives,
            "estimated_accidents_prevented_per_year": item["estimated_accidents_prevented_per_year"],
            "lives_saved_per_lakh_rupee": round(lives / cost_lakhs, 4) if cost_lakhs else 0,
            "unit_description": item["unit_description"],
        })
    return candidates


def allocate_budget(
    causes_df: pd.DataFrame,
    accidents_df: pd.DataFrame,
    total_budget_lakhs: float,
    states: list[str] | None = None,
    year: int | None = None,
) -> dict:
    if total_budget_lakhs <= 0:
        raise ValueError("total_budget_lakhs must be positive")

    target_states = states or STATES
    all_candidates: list[dict] = []
    for state in target_states:
        all_candidates.extend(_candidates_for_state(causes_df, accidents_df, state, year))

    if not all_candidates:
        raise ValueError("No candidate interventions could be built for the given states/year")

    # greedy 0/1 knapsack by lives-saved-per-rupee
    ranked = sorted(all_candidates, key=lambda c: c["lives_saved_per_lakh_rupee"], reverse=True)

    selected = []
    remaining_budget = float(total_budget_lakhs)
    for rank, c in enumerate(ranked, start=1):
        c = dict(c)
        c["rank"] = rank
        if c["estimated_cost_lakhs"] <= remaining_budget:
            c["funded"] = True
            remaining_budget -= c["estimated_cost_lakhs"]
            selected.append(c)
        else:
            c["funded"] = False
            selected.append(c)

    total_cost_used = sum(c["estimated_cost_lakhs"] for c in selected if c["funded"])
    total_lives_saved = sum(c["estimated_lives_saved_per_year"] for c in selected if c["funded"])
    total_accidents_prevented = sum(
        c["estimated_accidents_prevented_per_year"] for c in selected if c["funded"]
    )

    return {
        "methodology": "Greedy 0/1 knapsack: all (state, recommended intervention) candidates are ranked by estimated lives saved per lakh rupee spent, then funded in that order until the budget is exhausted. This is a fast, explainable heuristic, not a guaranteed globally-optimal allocation.",
        "total_budget_lakhs": total_budget_lakhs,
        "total_cost_used_lakhs": round(total_cost_used, 1),
        "budget_remaining_lakhs": round(total_budget_lakhs - total_cost_used, 1),
        "total_estimated_lives_saved_per_year": round(total_lives_saved, 1),
        "total_estimated_accidents_prevented_per_year": round(total_accidents_prevented),
        "num_states_covered": len({c["state"] for c in selected if c["funded"]}),
        "allocations": selected,
    }
