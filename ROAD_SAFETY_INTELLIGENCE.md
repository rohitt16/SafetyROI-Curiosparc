# SafetyROI

## Road Safety Intelligence System

SafetyROI is a full-stack machine-learning platform that converts historical and current road-condition data into operational intelligence for traffic authorities, urban planners, emergency teams, and road-safety officers.

This is a decision-support system, not merely an accident-statistics visualization dashboard.

## The Six Questions

1. **Where are accidents most likely to occur?**
2. **Why are accidents occurring there?**
3. **Who or what is most vulnerable?**
4. **When is the risk highest?**
5. **What intervention should be implemented first?**
6. **Can we predict whether the intervention will reduce accidents?**

## Project Highlights

- React and Vite frontend
- FastAPI backend
- Random Forest road-risk prediction model
- Explainable risk-factor breakdown
- Accident hotspot detection and geospatial hotspot view
- Weather-aware risk assessment
- Contextual safety recommendations
- Professional white-first interface with dark mode
- Login gate with professional user profile details
- Browser-session prediction history
- REST API with FastAPI documentation
- Deployment-ready Render and Vercel configuration

## Core Workflow

```text
Historical and live conditions
        |
        v
Hotspot identification
        |
        v
Risk probability prediction
        |
        v
Causal factor explanation
        |
        v
Vulnerable-user assessment
        |
        v
Intervention prioritization
        |
        v
Expected outcome prediction
```

## Intelligence Capabilities

### Where

Identify corridors and intersections with elevated collision probability so authorities can focus inspections, enforcement, engineering reviews, and emergency preparedness.

### Why

Explain the factors behind a risk result, including traffic density, visibility, weather, peak-hour exposure, road type, day/night conditions, and temperature.

### Who and what is vulnerable

Prioritize pedestrians, cyclists, two-wheeler riders, night commuters, and road users exposed to congested, rainy, foggy, or low-visibility conditions.

### When

Identify high-risk time windows such as morning and evening peaks, late-night travel, weekends, rainy periods, and traffic surges.

### What first

Prioritize interventions such as improved lighting, temporary speed control, intersection redesign, peak-period traffic management, drainage improvements, warning signage, targeted enforcement, and safer route selection.

### Will it work

Compare risk-sensitive options and estimate whether a proposed intervention or route is likely to reduce future crash exposure. Current demonstration impact values must be calibrated with validated intervention outcomes before production use.

## Current Application Workflow

1. Sign in with a professional user profile.
2. Select or enter a city and road profile.
3. Enter traffic, visibility, weather, temperature, and vehicle conditions.
4. Enter time and peak-hour conditions.
5. Run the risk assessment.
6. Review risk probability and level.
7. Inspect the factors driving the result.
8. Review the recommended action sequence.
9. Inspect hotspot intelligence.
10. Compare safer access options.
11. Review recent operational risk assessments.

## System Architecture

```text
React + Vite frontend
        |
        | REST API requests
        v
FastAPI backend
        |
        +-- POST /predict
        |       Risk prediction and recommendations
        |
        +-- GET /hotspots
                Hotspot locations and risk data
```

## Frontend

The frontend is located in `frontend/` and uses React with Vite.

Important files:

- `frontend/src/App.jsx` - Login gate, profile details, dashboard state, prediction flow, history, interventions, and theme handling
- `frontend/src/App.css` - Professional white-first design system, dark mode, responsive layout, and subtle animations
- `frontend/src/components/HotspotMap.jsx` - Hotspot intelligence view
- `frontend/src/main.jsx` - React bootstrap

The login gate collects full name, organization, role, operating location, work email, and password. Because the project has no authentication API, this is a frontend demonstration gate. It stores the active session and profile in `sessionStorage`; it is not production authentication.

After sign-in, the profile icon opens a panel with the user's name, role, email, organization, and location, plus a sign-out action. The white theme is default, and the sun/moon icon switches to dark mode.

## Backend

The backend is located in `backend/` and uses FastAPI.

Important files:

- `backend/main.py` - API application and prediction endpoints
- `backend/schemas.py` - Prediction request validation
- `backend/model_loader.py` - Machine-learning model loading
- `backend/hotspots.py` - Hotspot dataset
- `backend/encoders.py` - Feature encoding support

## Machine Learning Results

The documented model is a Random Forest Regressor for road-risk score prediction.

| Metric | Value |
| --- | --- |
| R2 score | 0.88 |
| Mean absolute error | 0.056 |

Reported feature contribution priorities:

| Feature | Contribution |
| --- | ---: |
| Visibility | 30.4% |
| Traffic density | 28.2% |
| Weather | 23.1% |
| Peak hour | 8.0% |
| Temperature | 2.2% |

Revalidate these figures when the training data, feature engineering, or model version changes.

## API Contract

### `GET /`

Health check endpoint.

```json
{
  "message": "SafetyROI API Running"
}
```

### `POST /predict`

Example request:

```json
{
  "city": "Delhi",
  "hour": 18,
  "day_of_week": "Monday",
  "is_weekend": 0,
  "road_type": "urban",
  "lanes": 4,
  "traffic_signal": 1,
  "weather": "rain",
  "visibility": 3,
  "temperature": 28,
  "traffic_density": "high",
  "vehicles_involved": 2,
  "is_peak_hour": 1
}
```

Response fields:

- `risk_score`
- `risk_level`
- `recommendations`
- `explanation`
- `risk_factors`

### `GET /hotspots`

Returns hotspot records used by the hotspot intelligence interface.

## Live Deployment

- Frontend: https://road-shield-ai.vercel.app
- Backend API: https://roadshield-ai.onrender.com
- API documentation: https://roadshield-ai.onrender.com/docs

## Local Setup

### Backend

From the project root:

```powershell
pip install -r requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Backend URL: `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

### Frontend

From the frontend directory:

```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5174
```

Frontend URL: `http://localhost:5174`

### Production build

```powershell
cd frontend
npm run build
```

## Project Structure

```text
SafetyROI-main/
├── backend/
│   ├── main.py
│   ├── schemas.py
│   ├── encoders.py
│   ├── model_loader.py
│   ├── hotspots.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── main.jsx
│   │   └── components/HotspotMap.jsx
│   ├── public/
│   └── package.json
├── models/
├── notebooks/
├── screenshots/
├── render.yaml
├── requirements.txt
└── ROAD_SAFETY_INTELLIGENCE.md
```

## Dataset and Notebooks

The project documentation describes an Indian road accident dataset containing approximately 20,000 records from multiple cities and covering weather, traffic, visibility, road infrastructure, temporal conditions, and risk-score information.

Notebooks:

- `notebooks/EDA.ipynb` - Exploratory data analysis
- `notebooks/risk_model.ipynb` - Risk model development
- `notebooks/hotspot_detection.ipynb` - Hotspot analysis

Confirm the exact dataset version and licensing before production or public redistribution.

## Dependencies

Backend dependencies are listed in `requirements.txt` and `backend/requirements.txt`.

Frontend dependencies are listed in `frontend/package.json`. The frontend uses React, Vite, Axios, React Leaflet, Leaflet, and related packages.

## Screenshots

Available project screenshots may include:

- `screenshots/prediction_dashboard_dark.png`
- `screenshots/prediction_dashboard_light.png`
- `screenshots/api_docs.png`
- `screenshots/hotspot_detection.png`
- `screenshots/hotspot_map.png`
- `screenshots/risk_analytics.png`

The current product direction prioritizes operational intelligence over a graph-only analytics experience.

## Security Notes

- Do not treat the frontend demo login as real authentication.
- Do not commit API keys, passwords, tokens, or private datasets.
- Store production secrets in deployment environment variables.
- Validate and restrict CORS origins for production deployment.
- Add server-side authentication and authorization before exposing authority or user-specific data.
- Validate uploaded or externally sourced data before model inference.
- Monitor model quality and drift after deployment.
- Report vulnerabilities privately to project maintainers.

## Product Positioning

SafetyROI helps authorities move from reactive reporting to preventive action:

```text
Accident data
    -> Risk intelligence
    -> Explainable priorities
    -> Targeted intervention
    -> Measurable safety outcomes
```

The product should be evaluated by the quality of decisions it enables: identifying the right corridor, understanding the cause, protecting vulnerable road users, acting at the right time, and measuring whether safety improved.

## Demonstration Disclaimer

The current application includes demonstration values for selected hotspot counts, intervention impact, route comparisons, and vulnerable-group summaries. These values communicate the intended product workflow. Production deployment should connect them to validated historical datasets, intervention records, live traffic feeds, and monitored post-intervention outcomes.
