from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class BudgetAllocationRequest(BaseModel):
    total_budget_lakhs: float = Field(
        ..., gt=0, description="Total budget in lakhs of rupees to allocate across states."
    )
    states: Optional[list[str]] = Field(
        None, description="Optional subset of states to consider. Defaults to all covered states."
    )
    year: Optional[int] = Field(
        None, description="Optional year to base estimates on. Defaults to the latest available year."
    )
