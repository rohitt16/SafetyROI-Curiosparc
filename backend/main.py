from fastapi import FastAPI
from model_loader import model
from backend.schemas import RiskInput
from fastapi.middleware.cors import CORSMiddleware
from backend.hotspots import hotspots



app = FastAPI(
    title="SafetyROI",
    description="Road Risk Prediction API",
    version="1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {
        "message": "SafetyROI API Running"
    }



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
        data.is_peak_hour
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
        recommendations.append(
            "Reduce speed and maintain safe braking distance."
        )

    if data.visibility < 5:
        recommendations.append(
            "Use headlights and stay alert in low visibility."
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
            "Consider postponing travel or choosing an alternate route."
        )

    if len(recommendations) == 0:
        recommendations.append(
            "Road conditions appear relatively safe."
        )

    explanation = []

    if data.weather == "rain":
        explanation.append("rainy weather")

    if data.visibility < 5:
        explanation.append(f"low visibility ({data.visibility} km)")

    if data.traffic_density == "high":
        explanation.append("high traffic density")

    if data.is_peak_hour == 1:
        explanation.append("peak-hour traffic")

    if explanation:
        explanation_text = (
            f"This route has a {level.lower()} accident risk because "
            + ", ".join(explanation)
            + " are significant factors that increase the likelihood of road incidents."
        )
    else:
        explanation_text = (
            "Current conditions indicate relatively safe travel."
        )

    return {
    "risk_score": round(risk, 3),
    "risk_level": level,
    "recommendations": recommendations,
    "explanation": explanation_text,
    "risk_factors": {
        "Visibility": "30.4%",
        "Traffic Density": "28.2%",
        "Weather": "23.1%",
        "Peak Hour": "8.0%"
    }
}

from backend.encoders import (
    CITY_MAP,
    DAY_MAP,
    ROAD_MAP,
    WEATHER_MAP,
    TRAFFIC_MAP
)
@app.get("/hotspots")
def get_hotspots():
    return hotspots