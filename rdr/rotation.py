from __future__ import annotations

from dataclasses import dataclass
import time

from .config import AppConfig
from .models import View, WeatherSnapshot
from .priority import ViewPlan, rotation_sequence


@dataclass
class RotationState:
    index: int = 0
    shown_at: float = 0.0
    plans: list[ViewPlan] | None = None


class RotationController:
    def __init__(self, config: AppConfig) -> None:
        self.config = config
        self.state = RotationState(shown_at=time.monotonic())

    def refresh(self, snapshot: WeatherSnapshot) -> None:
        previous = self.current_view if self.state.plans else None
        plans = rotation_sequence(snapshot, self.config)
        self.state.plans = plans
        if previous:
            for idx, plan in enumerate(plans):
                if plan.view == previous:
                    self.state.index = idx
                    return
        self.state.index = 0
        self.state.shown_at = time.monotonic()

    @property
    def current_plan(self) -> ViewPlan:
        assert self.state.plans
        return self.state.plans[self.state.index % len(self.state.plans)]

    @property
    def current_view(self) -> View:
        return self.current_plan.view

    def tick(self, now: float | None = None) -> View:
        now = now or time.monotonic()
        plan = self.current_plan
        if now - self.state.shown_at >= plan.duration:
            self.state.index = (self.state.index + 1) % len(self.state.plans or [plan])
            self.state.shown_at = now
        return self.current_view

    def force_next(self) -> None:
        if not self.state.plans:
            return
        self.state.index = (self.state.index + 1) % len(self.state.plans)
        self.state.shown_at = time.monotonic()
