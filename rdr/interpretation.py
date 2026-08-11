from __future__ import annotations

from .models import Severity, WeatherSnapshot


def current_intelligence(snapshot: WeatherSnapshot) -> str:
    alert = snapshot.most_severe_alert()
    if alert and alert.severity in {Severity.WARNING, Severity.EXTREME}:
        return alert.event.upper()

    lightning = snapshot.nearest_lightning_miles()
    if lightning is not None and lightning <= 25:
        direction = snapshot.storm_direction or "NEARBY"
        return f"LIGHTNING {lightning:.0f} MI {direction}".strip()

    if snapshot.rain_eta_minutes is not None:
        if snapshot.rain_eta_minutes <= 0:
            if (snapshot.rain_intensity or "").lower() == "heavy":
                return "HEAVY RAIN NOW"
            return "RAIN NOW"
        if snapshot.rain_eta_minutes <= 90:
            return f"RAIN IN ~{snapshot.rain_eta_minutes} MIN"

    if snapshot.storm_eta_minutes is not None and snapshot.storm_eta_minutes <= 120:
        return f"STORMS POSSIBLE IN ~{snapshot.storm_eta_minutes} MIN"

    if snapshot.hourly:
        wet = [h for h in snapshot.hourly[:6] if h.rain_probability_pct >= 60]
        if wet:
            return f"RAIN LIKELY AROUND {wet[0].at.strftime('%-I %p')}"
    return "CLEAR FOR NEXT FEW HOURS"


def cloud_headline(snapshot: WeatherSnapshot) -> str:
    condition = snapshot.observation.condition.lower()
    if "overcast" in condition:
        return "OVERCAST"
    if snapshot.cloud_bands:
        mean_vx = sum(b.vx for b in snapshot.cloud_bands) / len(snapshot.cloud_bands)
        return "CLOUDS MOVING IN" if mean_vx < 0 else "CLEARING FROM WEST"
    if "cloud" in condition:
        return "PARTLY CLOUDY"
    return "MOSTLY CLEAR"


def rain_arrival_headline(snapshot: WeatherSnapshot) -> tuple[str, str]:
    eta = snapshot.rain_eta_minutes
    if eta is None:
        return "NO RAIN NEARBY", ""
    if eta <= 0:
        return "RAIN", "NOW"
    return "RAIN", f"~{eta} MIN"


def lightning_headline(snapshot: WeatherSnapshot) -> tuple[str, str]:
    distance = snapshot.nearest_lightning_miles()
    if distance is None:
        return "NO LIGHTNING", "NEARBY"
    return "LIGHTNING", f"{distance:.0f} MI {snapshot.storm_direction or ''}".strip()
