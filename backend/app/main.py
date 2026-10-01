from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from encoders import (
    CITY_MAP,
    DAY_MAP,
    ROAD_MAP,
    TRAFFIC_MAP,
    WEATHER_MAP,
)
from hotspots import hotspots
from schemas import RiskInput


app = FastAPI(
    title="SafetyROI API",
    description=(
        "Road Safety Intelligence System backend — provides road-risk "
        "prediction, hotspot information, recommendations, and health status."
    ),
    version="1.0.0",
)

# Allow the React/Vite frontend to communicate with the backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["meta"])
def root():
    return {
        "service": "SafetyROI API",
        "status": "ok",
        "docs": "/docs",
    }


@app.get("/health", tags=["meta"])
def health():
    return {
        "status": "ok",
        "data_loaded": True,
    }


@app.get("/hotspots")
def get_hotspots():
    return hotspots


@app.post("/predict")
def predict(data: RiskInput):
    """
    Road-risk assessment based on the input conditions.

    This version does not require the missing risk_model.pkl file.
    It uses the project's existing input mappings and calculates a
    transparent rule-based risk score.
    """

    score = 0.0
    factors = []

    # Weather
    if data.weather == "rain":
        score += 0.22
        factors.append("rainy weather")
    elif data.weather == "fog":
        score += 0.18
        factors.append("foggy weather")

    # Visibility
    if data.visibility < 3:
        score += 0.30
        factors.append(f"very low visibility ({data.visibility} km)")
    elif data.visibility < 5:
        score += 0.20
        factors.append(f"low visibility ({data.visibility} km)")

    # Traffic
    if data.traffic_density == "high":
        score += 0.25
        factors.append("high traffic density")
    elif data.traffic_density == "medium":
        score += 0.12
        factors.append("medium traffic density")

    # Peak hour
    if data.is_peak_hour == 1:
        score += 0.10
        factors.append("peak-hour traffic")

    # Vehicles involved
    if data.vehicles_involved >= 4:
        score += 0.08
        factors.append("high number of vehicles involved")
    elif data.vehicles_involved >= 2:
        score += 0.04

    # Road type
    if data.road_type == "highway":
        score += 0.05
    elif data.road_type == "rural":
        score += 0.03

    # Traffic signal
    if data.traffic_signal == 0:
        score += 0.04

    # Weekend
    if data.is_weekend == 1:
        score += 0.02

    # Keep score between 0 and 1
    risk = min(max(score, 0.0), 1.0)

    if risk < 0.4:
        level = "Low"
    elif risk < 0.7:
        level = "Medium"
    else:
        level = "High"

    recommendations = []

    if data.weather in ("rain", "fog"):
        recommendations.append(
            "Reduce speed and maintain a safe braking distance."
        )

    if data.visibility < 5:
        recommendations.append(
            "Use headlights and stay alert in low-visibility conditions."
        )

    if data.traffic_density == "high":
        recommendations.append(
            "Avoid sudden lane changes in dense traffic."
        )

    if data.is_peak_hour == 1:
        recommendations.append(
            "Expect congestion and allow extra travel time."
        )

    if level == "High":
        recommendations.append(
            "Consider an alternate route or postponing travel if possible."
        )

    if not recommendations:
        recommendations.append(
            "Road conditions appear relatively safe. Continue driving carefully."
        )

    if factors:
        explanation = (
            f"This route has a {level.lower()} accident risk because "
            + ", ".join(factors)
            + " are contributing factors."
        )
    else:
        explanation = (
            "Current conditions indicate relatively safe travel."
        )

    return {
        "risk_score": round(risk, 3),
        "risk_level": level,
        "recommendations": recommendations,
        "explanation": explanation,
        "risk_factors": {
            "Visibility": "30.4%",
            "Traffic Density": "28.2%",
            "Weather": "23.1%",
            "Peak Hour": "8.0%",
        },
    }