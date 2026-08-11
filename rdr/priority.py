from __future__ import annotations

from dataclasses import dataclass

from .config import AppConfig
from .models import Severity, View, WeatherSnapshot


@dataclass(frozen=True)
class ViewPlan:
    view: View
    priority: int
    duration: float


def build_view_plan(snapshot: WeatherSnapshot, config: AppConfig) -> list[ViewPlan]:
    scores: dict[View, int] = {
        View.CURRENT: 60,
        View.RADAR: 55,
        View.FORECAST: 45,
        View.CLOUDS: 30,
    }

    if snapshot.rain_eta_minutes is not None and snapshot.rain_eta_minutes <= config.thresholds.rain_approach_minutes:
        scores[View.RADAR] = 90
        scores[View.RAIN_ARRIVAL] = 95
        scores[View.CURRENT] = 70

    nearest = snapshot.nearest_lightning_miles()
    if nearest is not None and nearest <= config.thresholds.lightning_watch_miles:
        scores[View.LIGHTNING] = 100 if nearest <= config.thresholds.lightning_warning_miles else 85
        scores[View.RADAR] = max(scores[View.RADAR], 80)
    if nearest is not None and nearest <= config.thresholds.lightning_override_miles:
        scores[View.LIGHTNING] = 130

    alert = snapshot.most_severe_alert()
    if alert:
        scores[View.SEVERE] = 115 if alert.severity in {Severity.WARNING, Severity.EXTREME} else 80
        scores[View.RADAR] = max(scores[View.RADAR], 90)
        if alert.severity == Severity.EXTREME:
            scores[View.SEVERE] = 150

    relevant_tropical = [s for s in snapshot.tropical if s.distance_miles <= config.thresholds.tropical_relevance_miles]
    if relevant_tropical:
        scores[View.TROPICAL] = 105
        scores[View.RADAR] = max(scores[View.RADAR], 75)
        scores[View.FORECAST] = max(scores[View.FORECAST], 65)

    plans = [
        ViewPlan(view=view, priority=priority, duration=config.rotation.duration_for(view.value))
        for view, priority in scores.items()
    ]
    return sorted(plans, key=lambda plan: (-plan.priority, plan.view.value))


def rotation_sequence(snapshot: WeatherSnapshot, config: AppConfig) -> list[ViewPlan]:
    ranked = build_view_plan(snapshot, config)
    sequence: list[ViewPlan] = []
    for plan in ranked:
        sequence.append(plan)
        if plan.priority >= 120:
            sequence.append(plan)
        elif plan.priority >= 90 and plan.view not in {View.CURRENT, View.FORECAST}:
            sequence.append(plan)
    return sequence
