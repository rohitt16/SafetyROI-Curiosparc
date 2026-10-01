from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse

from app.api.render import render
from app.data.store import store
from app.models.causes import cause_breakdown

router = APIRouter(tags=["causes"])


@router.get("/api/causes/{state}")
def get_causes(
    state: str,
    year: Optional[int] = Query(None),
    format: str = Query("json", pattern="^(json|html)$"),
):
    try:
        payload = cause_breakdown(store.causes, state, year)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if format == "html":
        return HTMLResponse(render("causes.html", payload=payload))
    return payload
