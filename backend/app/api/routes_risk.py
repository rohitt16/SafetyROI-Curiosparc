from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse

from app.api.render import render
from app.data.reference import CITY_COORDINATES, CITY_TO_STATE
from app.data.store import store
from app.models.mapping import build_risk_map_html
from app.models.risk_scoring import risk_scores_payload, compute_risk_scores

router = APIRouter(tags=["risk"])


@router.get("/api/risk-scores")
def get_risk_scores(
    year: Optional[int] = Query(None, description="Year to score. Defaults to latest available."),
    format: str = Query("json", pattern="^(json|html)$"),
):
    try:
        payload = risk_scores_payload(store.accidents, year)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if format == "html":
        return HTMLResponse(render("risk_scores.html", payload=payload))
    return payload


@router.get("/api/risk-map")
def get_risk_map(
    year: Optional[int] = Query(None),
    include_city_markers: bool = Query(
        False, description="Overlay top-N city risk markers on the choropleth (advanced feature)."
    ),
    top_n_cities: int = Query(8, ge=1, le=20),
):
    try:
        risk_df = compute_risk_scores(store.accidents, year)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    city_points = None
    if include_city_markers:
        city_df = store.city_accidents
        target_year = year or int(city_df["year"].max())
        latest = city_df[city_df["year"] == target_year].sort_values("accidents", ascending=False)
        top_cities = latest.head(top_n_cities)["city"].tolist()
        city_points = [
            {
                "label": city,
                "lat": CITY_COORDINATES[city][0],
                "lon": CITY_COORDINATES[city][1],
            }
            for city in top_cities
            if city in CITY_COORDINATES
        ]

    result = build_risk_map_html(risk_df, city_points=city_points, include_city_markers=include_city_markers)
    return {
        "year": int(risk_df["year"].iloc[0]),
        "mode": result["mode"],
        "note": result["note"],
        "html": result["html"],
    }
