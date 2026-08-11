from __future__ import annotations

from datetime import datetime
import pygame

from ..models import Severity, WeatherSnapshot
from .theme import Theme


class Fonts:
    def __init__(self) -> None:
        pygame.font.init()
        self.huge = pygame.font.Font(None, 100)
        self.xl = pygame.font.Font(None, 64)
        self.lg = pygame.font.Font(None, 42)
        self.md = pygame.font.Font(None, 30)
        self.sm = pygame.font.Font(None, 22)
        self.xs = pygame.font.Font(None, 18)


def text(surface, fonts: Fonts, value: str, pos: tuple[int, int], size: str, color, align: str = "left") -> pygame.Rect:
    font = getattr(fonts, size)
    image = font.render(value, True, color)
    rect = image.get_rect()
    if align == "center":
        rect.midtop = pos
    elif align == "right":
        rect.topright = pos
    else:
        rect.topleft = pos
    surface.blit(image, rect)
    return rect


def draw_header(surface, fonts: Fonts, theme: Theme, snapshot: WeatherSnapshot, now: datetime, stale_after: int) -> None:
    pygame.draw.rect(surface, theme.panel, (0, 0, 640, 42))
    text(surface, fonts, f"{snapshot.observation.temperature_f:.0f}°", (14, 5), "md", theme.text)
    text(surface, fonts, snapshot.location_name.upper(), (64, 9), "sm", theme.muted)
    text(surface, fonts, now.strftime("%-I:%M %p"), (625, 9), "sm", theme.text, "right")
    if snapshot.alerts:
        severe = snapshot.most_severe_alert()
        color = theme.danger if severe and severe.severity in {Severity.WARNING, Severity.EXTREME} else theme.warning
        pygame.draw.circle(surface, color, (522, 21), 7)
        text(surface, fonts, "ALERT", (536, 10), "xs", color)
    age_seconds = snapshot.age().total_seconds()
    if age_seconds > stale_after or not snapshot.network_ok:
        text(surface, fonts, f"STALE {int(age_seconds // 60)}M", (468, 10), "xs", theme.warning, "right")


def draw_location_marker(surface, theme: Theme, x: int = 320, y: int = 256) -> None:
    pygame.draw.circle(surface, theme.text, (x, y), 8, 2)
    pygame.draw.circle(surface, theme.accent, (x, y), 3)
    pygame.draw.line(surface, theme.text, (x - 12, y), (x - 5, y), 1)
    pygame.draw.line(surface, theme.text, (x + 5, y), (x + 12, y), 1)
    pygame.draw.line(surface, theme.text, (x, y - 12), (x, y - 5), 1)
    pygame.draw.line(surface, theme.text, (x, y + 5), (x, y + 12), 1)
