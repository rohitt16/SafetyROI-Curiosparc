from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.api.render import render
from app.data.store import store
from app.models.allocation import allocate_budget
from app.schemas import BudgetAllocationRequest
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["allocation"])


@router.post("/api/allocate-budget")
def post_allocate_budget(
    body: BudgetAllocationRequest,
    format: str = Query("json", pattern="^(json|html)$"),
):
    try:
        payload = allocate_budget(
            store.causes,
            store.accidents,
            body.total_budget_lakhs,
            states=body.states,
            year=body.year,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if format == "html":
        return HTMLResponse(render("allocation.html", payload=payload))
    return payload
