from __future__ import annotations

from abc import ABC, abstractmethod

from ..config import AppConfig
from ..models import WeatherSnapshot


class WeatherProvider(ABC):
    @abstractmethod
    def fetch(self, config: AppConfig) -> WeatherSnapshot:
        """Return a complete provider-neutral weather snapshot."""
