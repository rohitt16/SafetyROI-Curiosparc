"""Cause-breakdown analysis for a given state."""

from __future__ import annotations

import pandas as pd


def cause_breakdown(causes_df: pd.DataFrame, state: str, year: int | None = None) -> dict:
    df = causes_df[causes_df["state"] == state]
    if df.empty:
        raise ValueError(f"No cause data for state '{state}'")

    target_year = year or int(df["year"].max())
    snapshot = df[df["year"] == target_year].sort_values("share", ascending=False)
    if snapshot.empty:
        raise ValueError(f"No cause data for state '{state}' in {target_year}")

    total = snapshot["share"].sum()
    items = [
        {
            "cause": row["cause"],
            "share_pct": round(100 * row["share"] / total, 1),
        }
        for _, row in snapshot.iterrows()
    ]

    # simple year-over-year delta for the top cause, if prior year exists
    prev_year_df = df[df["year"] == target_year - 1]
    top_cause = items[0]["cause"] if items else None
    trend_note = None
    if top_cause and not prev_year_df.empty:
        prev_share = prev_year_df[prev_year_df["cause"] == top_cause]["share"]
        if not prev_share.empty:
            delta = (snapshot.iloc[0]["share"] - prev_share.iloc[0]) * 100
            direction = "up" if delta > 0.5 else ("down" if delta < -0.5 else "flat")
            trend_note = f"{top_cause} is {direction} {abs(round(delta, 1))} pts vs {target_year - 1}"

    return {
        "state": state,
        "year": target_year,
        "top_cause": top_cause,
        "trend_note": trend_note,
        "breakdown": items,
    }
