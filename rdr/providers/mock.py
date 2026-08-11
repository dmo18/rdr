from __future__ import annotations

from datetime import datetime, timedelta, timezone
from math import cos, radians
import random

from ..config import AppConfig
from ..models import (
    CloudBand,
    GeoPoint,
    HourlyPoint,
    LightningStrike,
    Observation,
    RadarCell,
    Severity,
    TropicalSystem,
    WeatherAlert,
    WeatherSnapshot,
)
from .base import WeatherProvider


SCENARIOS = (
    "clear",
    "approaching-rain",
    "heavy-rain",
    "nearby-thunderstorms",
    "frequent-lightning",
    "severe-thunderstorm-warning",
    "tornado-warning",
    "hurricane-approaching",
    "network-failure",
)


def _offset(origin: GeoPoint, miles_east: float, miles_north: float) -> GeoPoint:
    lat = origin.latitude + miles_north / 69.0
    lon = origin.longitude + miles_east / max(1.0, 69.0 * cos(radians(origin.latitude)))
    return GeoPoint(lat, lon)


class MockWeatherProvider(WeatherProvider):
    def __init__(self, scenario: str = "clear", seed: int = 7) -> None:
        if scenario not in SCENARIOS:
            raise ValueError(f"Unknown scenario: {scenario}")
        self.scenario = scenario
        self.random = random.Random(seed)

    def fetch(self, config: AppConfig) -> WeatherSnapshot:
        now = datetime.now(timezone.utc)
        loc = GeoPoint(config.location.latitude, config.location.longitude)
        snapshot = WeatherSnapshot(
            location_name=config.location.name,
            location=loc,
            observation=Observation(72, 74, "Partly Cloudy", 61, 9, "SW", now),
            hourly=[
                HourlyPoint(now + timedelta(hours=i), 72 - i * 1.2, "Cloudy" if i < 3 else "Partly Cloudy", 10 + i * 5, 8 + i)
                for i in range(6)
            ],
            radar_cells=[],
            cloud_bands=[CloudBand(540, 160, 150, 72, -8), CloudBand(670, 280, 180, 84, -10)],
            data_updated_at=now,
            data_source="mock",
        )
        self._apply(snapshot, now)
        return snapshot

    def _apply(self, snapshot: WeatherSnapshot, now: datetime) -> None:
        if self.scenario == "clear":
            snapshot.observation = Observation(76, 77, "Mostly Clear", 48, 5, "NW", now)
            snapshot.cloud_bands = []
            snapshot.hourly = [HourlyPoint(now + timedelta(hours=i), 76 - i, "Clear", 5, 5) for i in range(6)]
            return

        storm_scenarios = {
            "approaching-rain",
            "heavy-rain",
            "nearby-thunderstorms",
            "frequent-lightning",
            "severe-thunderstorm-warning",
            "tornado-warning",
        }
        if self.scenario in storm_scenarios:
            snapshot.rain_eta_minutes = 18 if self.scenario != "heavy-rain" else 0
            snapshot.rain_intensity = "heavy" if self.scenario == "heavy-rain" else "moderate"
            snapshot.radar_cells = [
                RadarCell(485, 230, 72, 0.72, -13, 1),
                RadarCell(560, 185, 48, 0.92, -12, 2),
                RadarCell(610, 300, 62, 0.58, -10, -1),
            ]
            snapshot.hourly = [
                HourlyPoint(
                    now + timedelta(hours=i),
                    72 - i,
                    "Rain" if i in (1, 2) else "Cloudy",
                    [20, 80, 90, 45, 25, 15][i],
                    10 + i * 2,
                )
                for i in range(6)
            ]

        thunder_scenarios = {
            "nearby-thunderstorms",
            "frequent-lightning",
            "severe-thunderstorm-warning",
            "tornado-warning",
        }
        if self.scenario in thunder_scenarios:
            snapshot.storm_eta_minutes = 22
            snapshot.storm_direction = "W"
            count = 8 if self.scenario == "frequent-lightning" else 4
            snapshot.lightning = [
                LightningStrike(
                    _offset(snapshot.location, -5 - i * 1.8, 1.5 - i * 0.4),
                    now - timedelta(seconds=i * 45),
                )
                for i in range(count)
            ]

        if self.scenario == "severe-thunderstorm-warning":
            snapshot.alerts = [WeatherAlert(
                event="Severe Thunderstorm Warning",
                severity=Severity.WARNING,
                headline="Damaging wind and frequent lightning possible",
                source="Mock NWS",
                expires_at=now + timedelta(minutes=35),
                distance_miles=8.2,
                motion="MOVING NE 35 MPH",
                polygon_offsets=((-90, -50), (-15, -85), (85, -10), (45, 75), (-70, 55)),
            )]

        if self.scenario == "tornado-warning":
            snapshot.alerts = [WeatherAlert(
                event="Tornado Warning",
                severity=Severity.EXTREME,
                headline="Take shelter now",
                source="Mock NWS",
                expires_at=now + timedelta(minutes=28),
                distance_miles=8.2,
                motion="MOVING NE 35 MPH",
                polygon_offsets=((-100, 35), (-15, -70), (100, -20), (50, 85), (-80, 78)),
            )]

        if self.scenario == "hurricane-approaching":
            snapshot.tropical = [TropicalSystem(
                name="ALICE",
                classification="HURRICANE",
                category=2,
                center=_offset(snapshot.location, 420, -440),
                movement="NW 13 MPH",
                distance_miles=610,
                closest_approach="~3 DAYS",
                watches_warnings=("TROPICAL STORM WATCH",),
                track_offsets=((160, 150), (95, 70), (35, 0), (-5, -85), (-45, -170)),
            )]
            snapshot.hourly = [
                HourlyPoint(now + timedelta(hours=i), 79 - i * 0.5, "Breezy", 30 + i * 5, 18 + i * 3)
                for i in range(6)
            ]

        if self.scenario == "network-failure":
            snapshot.network_ok = False
            snapshot.data_updated_at = now - timedelta(minutes=18)
