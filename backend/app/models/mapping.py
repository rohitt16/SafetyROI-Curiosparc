"""
Risk map generation (Plotly), returned as embeddable HTML for the
HTMX frontend.

Choropleth needs an India state-boundary GeoJSON. We don't ship one in
the repo (keep it light); at first request we try, in order:
  1. a local cached copy at data_files/india_states.geojson
  2. a well-known public GeoJSON URL (cached to disk on success)
  3. a horizontal bar-chart fallback ranked by risk score, so the
     endpoint always returns something useful even fully offline —
     the response metadata says which mode was used.

Muted amber -> red risk color scale per the frontend's stated design
direction; the backend just needs to pick a reasonable colorscale so
the HTML fragment isn't visually broken if embedded directly.
"""

from __future__ import annotations

import json
import os

import pandas as pd

DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data_files"
)
GEOJSON_PATH = os.path.join(DATA_DIR, "india_states.geojson")
GEOJSON_URL = (
    "https://raw.githubusercontent.com/Subhash9325/"
    "GeoJson-Data-of-Indian-States/master/Indian_States"
)

_RISK_COLORSCALE = [
    [0.0, "#fde3b0"],   # soft amber (low risk)
    [0.5, "#f2a65a"],
    [1.0, "#b3392f"],   # muted red (high risk)
]


def _load_geojson():
    if os.path.exists(GEOJSON_PATH):
        try:
            with open(GEOJSON_PATH) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass

    try:
        import requests

        resp = requests.get(GEOJSON_URL, timeout=5)
        resp.raise_for_status()
        geojson = resp.json()
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(GEOJSON_PATH, "w") as f:
            json.dump(geojson, f)
        return geojson
    except Exception:
        return None


def _geojson_state_key(geojson: dict) -> str | None:
    """Different community GeoJSON releases name the state property
    differently; probe common keys."""
    if not geojson or not geojson.get("features"):
        return None
    props = geojson["features"][0].get("properties", {})
    for key in ("NAME_1", "st_nm", "name", "State_Name", "STATE"):
        if key in props:
            return key
    return None


def build_risk_map_html(
    risk_df: pd.DataFrame,
    city_points: list[dict] | None = None,
    include_city_markers: bool = False,
) -> dict:
    try:
        import plotly.graph_objects as go
    except ImportError:
        return {
            "mode": "unavailable",
            "note": "plotly is not installed in this environment.",
            "html": "<div>Map unavailable: plotly not installed.</div>",
        }

    geojson = _load_geojson()
    key = _geojson_state_key(geojson) if geojson else None

    if geojson and key:
        fig = go.Figure(
            go.Choropleth(
                geojson=geojson,
                featureidkey=f"properties.{key}",
                locations=risk_df["state"],
                z=risk_df["risk_score"],
                colorscale=_RISK_COLORSCALE,
                zmin=0,
                zmax=100,
                marker_line_color="#ffffff",
                marker_line_width=0.6,
                colorbar_title="Risk score",
                text=risk_df["state"],
                hovertemplate="<b>%{text}</b><br>Risk score: %{z}<extra></extra>",
            )
        )
        fig.update_geos(
            visible=False,
            fitbounds="locations",
            projection_type="mercator",
        )
        mode = "choropleth"

        if include_city_markers and city_points:
            fig.add_trace(
                go.Scattergeo(
                    lon=[c["lon"] for c in city_points],
                    lat=[c["lat"] for c in city_points],
                    text=[c["label"] for c in city_points],
                    mode="markers+text",
                    textposition="top center",
                    marker=dict(size=8, color="#2f4858", line=dict(width=1, color="white")),
                    hovertemplate="%{text}<extra></extra>",
                    name="Top cities",
                )
            )
    else:
        # Fallback: ranked bar chart so the endpoint never hard-fails
        ranked = risk_df.sort_values("risk_score", ascending=True)
        fig = go.Figure(
            go.Bar(
                x=ranked["risk_score"],
                y=ranked["state"],
                orientation="h",
                marker_color=ranked["risk_score"],
                marker_colorscale=_RISK_COLORSCALE,
                hovertemplate="<b>%{y}</b><br>Risk score: %{x}<extra></extra>",
            )
        )
        fig.update_layout(xaxis_title="Risk score", yaxis_title=None)
        mode = "bar_fallback"

    fig.update_layout(
        margin=dict(l=0, r=0, t=10, b=0),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(family="Inter, system-ui, sans-serif", size=12),
        height=520,
    )

    html = fig.to_html(full_html=False, include_plotlyjs="cdn", config={"displayModeBar": False})

    return {
        "mode": mode,
        "note": (
            None
            if mode == "choropleth"
            else "State boundary GeoJSON was unavailable, so a ranked bar chart is shown instead of a choropleth."
        ),
        "html": html,
    }
