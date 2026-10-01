from pydantic import BaseModel

class RiskInput(BaseModel):
    city: str
    hour: int
    day_of_week: str
    is_weekend: int
    road_type: str
    lanes: int
    traffic_signal: int
    weather: str
    visibility: float
    temperature: float
    traffic_density: str
    vehicles_involved: int
    is_peak_hour: int