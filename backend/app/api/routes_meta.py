from __future__ import annotations

from fastapi import APIRouter

from app.data.reference import STATES
from app.data.store import store

router = APIRouter(tags=["meta"])


@router.get("/api/meta/states")
def list_states():
    years = sorted(store.accidents["year"].unique().tolist())
    return {"states": STATES, "years": years, "latest_year": max(years)}


@router.get("/api/meta/summary")
def national_summary():
    from app.models.risk_scoring import compute_risk_scores

    df = compute_risk_scores(store.accidents)
    top = df.iloc[0]
    return {
        "year": int(df["year"].iloc[0]),
        "states_covered": len(df),
        "national_total_accidents": int(df["accidents"].sum()),
        "national_total_fatalities": int(df["fatalities"].sum()),
        "top_risk_state": top["state"],
        "top_risk_score": float(top["risk_score"]),
    }
