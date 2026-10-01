from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse

from app.api.render import render
from app.data.store import store
from app.models.forecasting import forecast_state

router = APIRouter(tags=["forecast"])


@router.get("/api/forecast/{state}")
def get_forecast(
    state: str,
    horizon: int = Query(1, ge=1, le=5, description="Number of future years to forecast."),
    format: str = Query("json", pattern="^(json|html)$"),
):
    try:
        payload = forecast_state(store.accidents, state, horizon)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if format == "html":
        return HTMLResponse(render("forecast.html", payload=payload))
    return payload
