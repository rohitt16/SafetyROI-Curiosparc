"""
Renders plain, semantically-marked-up HTML fragments for `?format=html`
requests, so the HTMX frontend can swap them directly. No styling
opinions here (no Bootstrap classes baked in) — the frontend build
owns visual design; this just emits sane, swappable markup with
stable element ids/data-attributes to hook CSS/JS onto.
"""

from __future__ import annotations

import os

from jinja2 import Environment, FileSystemLoader, select_autoescape

_env = Environment(
    loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), "..", "templates")),
    autoescape=select_autoescape(["html"]),
)


def render(template_name: str, **context) -> str:
    template = _env.get_template(template_name)
    return template.render(**context)
