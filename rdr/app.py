from __future__ import annotations

from datetime import datetime
import logging
import time

import pygame

from .cache import MemoryCache
from .config import AppConfig
from .providers.base import WeatherProvider
from .rotation import RotationController
from .ui.components import Fonts
from .ui.screens import DRAWERS
from .ui.theme import make_theme


class WeatherDisplayApp:
    def __init__(self, config: AppConfig, provider: WeatherProvider, scenario_name: str = "") -> None:
        self.config = config
        self.provider = provider
        self.scenario_name = scenario_name
        self.cache = MemoryCache()
        self.rotation = RotationController(config)
        self.log = logging.getLogger("rdr")
        self.snapshot = self._fetch_with_fallback()
        self.rotation.refresh(self.snapshot)
        self.last_refresh = time.monotonic()

    def _fetch_with_fallback(self):
        try:
            snapshot = self.provider.fetch(self.config)
            self.cache.put("snapshot", snapshot)
            return snapshot
        except Exception:
            self.log.exception("Weather provider failed")
            cached = self.cache.get("snapshot")
            if cached is not None:
                cached.network_ok = False
                return cached
            raise

    def _refresh_if_due(self) -> None:
        if time.monotonic() - self.last_refresh < self.config.data.refresh_seconds:
            return
        self.snapshot = self._fetch_with_fallback()
        self.rotation.refresh(self.snapshot)
        self.last_refresh = time.monotonic()

    def run(self) -> int:
        pygame.init()
        flags = pygame.FULLSCREEN if self.config.display.fullscreen else 0
        screen = pygame.display.set_mode((self.config.display.width, self.config.display.height), flags)
        pygame.display.set_caption("RDR Weather Display")
        clock = pygame.time.Clock()
        fonts = Fonts()
        started = time.monotonic()
        running = True
        while running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key in (pygame.K_ESCAPE, pygame.K_q):
                        running = False
                    elif event.key in (pygame.K_SPACE, pygame.K_RIGHT):
                        self.rotation.force_next()

            self._refresh_if_due()
            view = self.rotation.tick()
            local_now = datetime.now().astimezone()
            night = (
                local_now.hour >= self.config.display.night_start_hour
                or local_now.hour < self.config.display.night_end_hour
            )
            theme = make_theme(night)
            DRAWERS[view](
                screen,
                fonts,
                theme,
                self.snapshot,
                self.config,
                local_now,
                time.monotonic() - started,
            )
            pygame.display.flip()
            clock.tick(self.config.display.fps)
        pygame.quit()
        return 0
