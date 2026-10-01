from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse

from app.api.render import render
from app.data.store import store
from app.models.seasonal import seasonal_risk

router = APIRouter(tags=["seasonal"])


@router.get("/api/seasonal-risk/{state}")
def get_seasonal_risk(
    state: str,
    format: str = Query("json", pattern="^(json|html)$"),
):
    try:
        payload = seasonal_risk(store.seasonal, store.accidents, state)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if format == "html":
        return HTMLResponse(render("seasonal.html", payload=payload))
    return payload
