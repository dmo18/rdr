from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import tomllib


@dataclass
class LocationConfig:
    name: str = "Home"
    latitude: float = 35.7796
    longitude: float = -78.6382
    units: str = "imperial"


@dataclass
class DisplayConfig:
    width: int = 640
    height: int = 480
    fullscreen: bool = False
    fps: int = 30
    night_start_hour: int = 21
    night_end_hour: int = 6


@dataclass
class RotationConfig:
    current_seconds: float = 8
    radar_seconds: float = 10
    forecast_seconds: float = 8
    clouds_seconds: float = 7
    lightning_seconds: float = 7
    rain_arrival_seconds: float = 8
    severe_seconds: float = 12
    tropical_seconds: float = 10

    def duration_for(self, view_name: str) -> float:
        return float(getattr(self, f"{view_name}_seconds"))


@dataclass
class ThresholdConfig:
    lightning_watch_miles: float = 25.0
    lightning_warning_miles: float = 10.0
    lightning_override_miles: float = 5.0
    tropical_relevance_miles: float = 900.0
    rain_approach_minutes: int = 90


@dataclass
class DataConfig:
    provider: str = "mock"
    refresh_seconds: int = 60
    stale_after_seconds: int = 900
    weather_api_key_env: str = "RDR_WEATHER_API_KEY"


@dataclass
class AppConfig:
    location: LocationConfig = field(default_factory=LocationConfig)
    display: DisplayConfig = field(default_factory=DisplayConfig)
    rotation: RotationConfig = field(default_factory=RotationConfig)
    thresholds: ThresholdConfig = field(default_factory=ThresholdConfig)
    data: DataConfig = field(default_factory=DataConfig)


def _merge_dataclass(instance, values: dict) -> None:
    for key, value in values.items():
        if hasattr(instance, key):
            setattr(instance, key, value)


def load_config(path: str | Path | None = None) -> AppConfig:
    cfg = AppConfig()
    if path is None:
        default = Path("config.toml")
        if not default.exists():
            return cfg
        path = default
    path = Path(path)
    if not path.exists():
        return cfg
    with path.open("rb") as fh:
        raw = tomllib.load(fh)
    for section in ("location", "display", "rotation", "thresholds", "data"):
        if section in raw:
            _merge_dataclass(getattr(cfg, section), raw[section])
    return cfg
