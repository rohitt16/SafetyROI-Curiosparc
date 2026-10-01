"""
Simple, explainable forecasting.

Per problem-statement guidance ("keep the model simple and
explainable... do not overfit"), this fits ordinary least-squares
linear regression of accidents ~ year using scikit-learn's
LinearRegression on the state's historical series, and falls back to a
3-year moving average if there are too few points for a stable fit.
Both the slope/intercept/R^2 (or the moving-average window) are
returned so the forecast is auditable, not a black box.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score


def forecast_state(accidents_df: pd.DataFrame, state: str, horizon: int = 1) -> dict:
    hist = accidents_df[accidents_df["state"] == state].sort_values("year")
    if hist.empty:
        raise ValueError(f"No accident data for state '{state}'")

    years = hist["year"].to_numpy().reshape(-1, 1)
    counts = hist["accidents"].to_numpy()

    if len(hist) < 3:
        # not enough points for a meaningful regression — use last
        # observed value flat-forecast, flagged as such
        last_year = int(hist["year"].max())
        last_value = float(hist["accidents"].iloc[-1])
        forecasts = [
            {"year": last_year + i, "predicted_accidents": round(last_value)}
            for i in range(1, horizon + 1)
        ]
        return {
            "state": state,
            "method": "insufficient_history_flat_forecast",
            "note": "Fewer than 3 years of history available; forecast holds the last observed value flat.",
            "history": hist[["year", "accidents"]].to_dict("records"),
            "forecast": forecasts,
        }

    model = LinearRegression()
    model.fit(years, counts)
    preds_in_sample = model.predict(years)
    r2 = float(r2_score(counts, preds_in_sample))

    last_year = int(hist["year"].max())
    future_years = np.array([[last_year + i] for i in range(1, horizon + 1)])
    future_preds = model.predict(future_years)
    future_preds = np.clip(future_preds, 0, None)

    # Also compute a 3-year moving average as a simple cross-check
    ma_window = min(3, len(hist))
    moving_avg = hist["accidents"].tail(ma_window).mean()

    forecasts = [
        {"year": int(fy[0]), "predicted_accidents": round(float(fp))}
        for fy, fp in zip(future_years, future_preds)
    ]

    slope = float(model.coef_[0])
    direction = "increasing" if slope > 5 else ("decreasing" if slope < -5 else "flat")

    return {
        "state": state,
        "method": "linear_regression",
        "model_explainability": {
            "slope_accidents_per_year": round(slope, 2),
            "intercept": round(float(model.intercept_), 2),
            "r_squared": round(r2, 3),
            "trend_direction": direction,
            "cross_check_3yr_moving_average": round(float(moving_avg), 1),
        },
        "history": hist[["year", "accidents"]].to_dict("records"),
        "forecast": forecasts,
    }


def forecast_risk_score(risk_scores_by_year: pd.DataFrame, state: str, horizon: int = 1) -> dict:
    """Same approach applied to the risk_score series itself, if
    multi-year risk scores are available. Currently the API forecasts
    accident counts as the primary signal (see forecast_state); this
    helper is available for future extension."""
    hist = risk_scores_by_year[risk_scores_by_year["state"] == state].sort_values("year")
    if len(hist) < 3:
        return {"state": state, "method": "insufficient_history", "forecast": []}
    years = hist["year"].to_numpy().reshape(-1, 1)
    scores = hist["risk_score"].to_numpy()
    model = LinearRegression().fit(years, scores)
    last_year = int(hist["year"].max())
    future_years = np.array([[last_year + i] for i in range(1, horizon + 1)])
    preds = np.clip(model.predict(future_years), 0, 100)
    return {
        "state": state,
        "method": "linear_regression",
        "forecast": [
            {"year": int(fy[0]), "predicted_risk_score": round(float(p), 1)}
            for fy, p in zip(future_years, preds)
        ],
    }
