from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse

from app.api.render import render
from app.data.store import store
from app.models.interventions import recommend_interventions

router = APIRouter(tags=["interventions"])


@router.get("/api/interventions/{state}")
def get_interventions(
    state: str,
    year: Optional[int] = Query(None),
    top_n: int = Query(3, ge=3, le=9),
    format: str = Query("json", pattern="^(json|html)$"),
):
    try:
        payload = recommend_interventions(store.causes, state, year, top_n)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if format == "html":
        return HTMLResponse(render("interventions.html", payload=payload))
    return payload
