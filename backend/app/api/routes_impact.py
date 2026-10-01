from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse

from app.api.render import render
from app.data.store import store
from app.models.impact import impact_estimate

router = APIRouter(tags=["impact"])


@router.get("/api/impact-estimate/{state}")
def get_impact_estimate(
    state: str,
    year: Optional[int] = Query(None),
    format: str = Query("json", pattern="^(json|html)$"),
):
    try:
        payload = impact_estimate(store.causes, store.accidents, state, year)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if format == "html":
        return HTMLResponse(render("impact.html", payload=payload))
    return payload
