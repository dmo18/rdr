from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from math import atan2, cos, radians, sin, sqrt


class Severity(str, Enum):
    INFO = "info"
    WATCH = "watch"
    WARNING = "warning"
    EXTREME = "extreme"


class View(str, Enum):
    CURRENT = "current"
    RADAR = "radar"
    RAIN_ARRIVAL = "rain_arrival"
    FORECAST = "forecast"
    CLOUDS = "clouds"
    LIGHTNING = "lightning"
    SEVERE = "severe"
    TROPICAL = "tropical"


@dataclass(frozen=True)
class GeoPoint:
    latitude: float
    longitude: float

    def distance_miles_to(self, other: "GeoPoint") -> float:
        r = 3958.7613
        lat1, lat2 = radians(self.latitude), radians(other.latitude)
        dlat = radians(other.latitude - self.latitude)
        dlon = radians(other.longitude - self.longitude)
        a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
        return 2 * r * atan2(sqrt(a), sqrt(max(0.0, 1 - a)))


@dataclass(frozen=True)
class Observation:
    temperature_f: float
    feels_like_f: float
    condition: str
    humidity_pct: int
    wind_mph: float
    wind_direction: str
    observed_at: datetime


@dataclass(frozen=True)
class HourlyPoint:
    at: datetime
    temperature_f: float
    condition: str
    rain_probability_pct: int
    wind_mph: float = 0.0


@dataclass(frozen=True)
class LightningStrike:
    location: GeoPoint
    occurred_at: datetime


@dataclass(frozen=True)
class WeatherAlert:
    event: str
    severity: Severity
    headline: str
    source: str
    expires_at: datetime
    distance_miles: float | None = None
    motion: str | None = None
    polygon_offsets: tuple[tuple[float, float], ...] = ()


@dataclass(frozen=True)
class TropicalSystem:
    name: str
    classification: str
    category: int | None
    center: GeoPoint
    movement: str
    distance_miles: float
    closest_approach: str
    watches_warnings: tuple[str, ...] = ()
    track_offsets: tuple[tuple[float, float], ...] = ()


@dataclass(frozen=True)
class RadarCell:
    x: float
    y: float
    radius: float
    intensity: float
    vx: float
    vy: float


@dataclass(frozen=True)
class CloudBand:
    x: float
    y: float
    width: float
    height: float
    vx: float


@dataclass
class WeatherSnapshot:
    location_name: str
    location: GeoPoint
    observation: Observation
    hourly: list[HourlyPoint] = field(default_factory=list)
    lightning: list[LightningStrike] = field(default_factory=list)
    alerts: list[WeatherAlert] = field(default_factory=list)
    tropical: list[TropicalSystem] = field(default_factory=list)
    radar_cells: list[RadarCell] = field(default_factory=list)
    cloud_bands: list[CloudBand] = field(default_factory=list)
    rain_eta_minutes: int | None = None
    rain_intensity: str | None = None
    storm_eta_minutes: int | None = None
    storm_direction: str | None = None
    data_updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    data_source: str = "mock"
    network_ok: bool = True

    def age(self, now: datetime | None = None) -> timedelta:
        now = now or datetime.now(timezone.utc)
        stamp = self.data_updated_at
        if stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=timezone.utc)
        return now - stamp

    def nearest_lightning_miles(self) -> float | None:
        if not self.lightning:
            return None
        return min(self.location.distance_miles_to(s.location) for s in self.lightning)

    def most_severe_alert(self) -> WeatherAlert | None:
        rank = {Severity.INFO: 0, Severity.WATCH: 1, Severity.WARNING: 2, Severity.EXTREME: 3}
        return max(self.alerts, key=lambda a: rank[a.severity], default=None)
