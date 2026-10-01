from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from encoders import CITY_MAP, DAY_MAP, ROAD_MAP, TRAFFIC_MAP, WEATHER_MAP
from hotspots import hotspots
from model_loader import model
from schemas import RiskInput

from app.api import (
    routes_allocation,
    routes_causes,
    routes_forecast,
    routes_impact,
    routes_interventions,
    routes_meta,
    routes_risk,
    routes_seasonal,
    routes_vulnerability,
)
from app.data.store import store

app = FastAPI(
    title="SafetyROI API",
    description=(
        "Road Safety Intelligence System backend — turns historical MoRTH / "
        "NCRB / data.gov.in style accident data into risk scores, cause "
        "analysis, forecasts, intervention recommendations, impact "
        "estimates, and budget-constrained prioritization."
    ),
    version="1.0.0",
)

# Permissive CORS for hackathon/demo purposes — the HTMX frontend may be
# served from a different origin/port during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _load_data():
    store.refresh()


@app.post("/predict")
def predict(data: RiskInput):
    values = [[
        CITY_MAP[data.city],
        data.hour,
        DAY_MAP[data.day_of_week],
        data.is_weekend,
        ROAD_MAP[data.road_type],
        data.lanes,
        data.traffic_signal,
        WEATHER_MAP[data.weather],
        data.visibility,
        data.temperature,
        TRAFFIC_MAP[data.traffic_density],
        data.vehicles_involved,
        data.is_peak_hour,
    ]]

    risk = float(model.predict(values)[0])

    if risk < 0.4:
        level = "Low"
    elif risk < 0.7:
        level = "Medium"
    else:
        level = "High"

    recommendations = []
    if data.weather == "rain":
        recommendations.append("Reduce speed and maintain safe braking distance.")
    if data.visibility < 5:
        recommendations.append("Use headlights and stay alert in low visibility.")
    if data.traffic_density == "high":
        recommendations.append("Avoid sudden lane changes in dense traffic.")
    if data.is_peak_hour == 1:
        recommendations.append("Expect congestion and allow extra travel time.")
    if level == "High":
        recommendations.append("Consider postponing travel or choosing an alternate route.")
    if not recommendations:
        recommendations.append("Road conditions appear relatively safe.")

    explanation_parts = []
    if data.weather == "rain":
        explanation_parts.append("rainy weather")
    if data.visibility < 5:
        explanation_parts.append(f"low visibility ({data.visibility} km)")
    if data.traffic_density == "high":
        explanation_parts.append("high traffic density")
    if data.is_peak_hour == 1:
        explanation_parts.append("peak-hour traffic")

    if explanation_parts:
        explanation = (
            f"This route has a {level.lower()} accident risk because "
            + ", ".join(explanation_parts)
            + " are significant factors that increase the likelihood of road incidents."
        )
    else:
        explanation = "Current conditions indicate relatively safe travel."

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


@app.get("/hotspots")
def get_hotspots():
    return hotspots


@app.get("/", tags=["meta"])
def root():
    return {
        "service": "SafetyROI API",
        "status": "ok",
        "docs": "/docs",
    }


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "data_loaded": store.loaded}


app.include_router(routes_risk.router)
app.include_router(routes_causes.router)
app.include_router(routes_forecast.router)
app.include_router(routes_interventions.router)
app.include_router(routes_impact.router)
app.include_router(routes_allocation.router)
app.include_router(routes_vulnerability.router)
app.include_router(routes_seasonal.router)
app.include_router(routes_meta.router)
