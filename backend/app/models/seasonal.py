"""Seasonal/temporal risk flags — surfaces month/season spikes to
support proactive rather than reactive deployment of interventions.

Source note: MoRTH/NCRB public releases are annual, not month-level,
so this model applies known seasonal effect multipliers (monsoon,
festival travel, winter fog) to the state's annual accident volume
rather than reading month-level accident counts directly. This is
disclosed in the response metadata.
"""

from __future__ import annotations

import pandas as pd


def seasonal_risk(seasonal_df: pd.DataFrame, accidents_df: pd.DataFrame, state: str) -> dict:
    sub = seasonal_df[seasonal_df["state"] == state].copy()
    if sub.empty:
        raise ValueError(f"No seasonal data for state '{state}'")

    latest_year = int(accidents_df[accidents_df["state"] == state]["year"].max())
    annual = accidents_df[
        (accidents_df["state"] == state) & (accidents_df["year"] == latest_year)
    ]["accidents"]
    annual_total = float(annual.iloc[0]) if not annual.empty else None

    sub = sub.sort_values("relative_risk_index", ascending=False)
    avg_index = sub["relative_risk_index"].mean()

    months = []
    for _, row in sub.iterrows():
        est_share = row["relative_risk_index"] / sub["relative_risk_index"].sum()
        months.append({
            "month": row["month"],
            "relative_risk_index": round(float(row["relative_risk_index"]), 3),
            "flag": "elevated" if row["relative_risk_index"] > avg_index * 1.05 else "normal",
            "estimated_monthly_accidents": (
                round(annual_total * est_share) if annual_total else None
            ),
        })

    high_risk_months = [m["month"] for m in months if m["flag"] == "elevated"]

    return {
        "state": state,
        "reference_year_for_volume": latest_year,
        "note": "Month-level risk is modeled from known seasonal effects (monsoon, festival travel, winter fog) applied to annual volume, not sourced from month-level government releases.",
        "high_risk_months": high_risk_months,
        "months": sorted(months, key=lambda m: [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ].index(m["month"])),
    }
