from __future__ import annotations

from datetime import datetime, timezone
import pygame

from ..config import AppConfig
from ..interpretation import cloud_headline, current_intelligence, lightning_headline, rain_arrival_headline
from ..models import Severity, View, WeatherSnapshot
from .components import Fonts, draw_header, draw_location_marker, text
from .theme import Theme


def _map_background(surface, theme: Theme) -> None:
    surface.fill(theme.bg)
    pygame.draw.rect(surface, theme.panel, (16, 58, 608, 402), border_radius=8)
    for x in range(40, 640, 80):
        pygame.draw.line(surface, theme.map_line, (x, 60), (x - 35, 458), 1)
    for y in range(100, 450, 70):
        pygame.draw.line(surface, theme.map_line, (18, y), (622, y + 22), 1)
    pygame.draw.line(surface, theme.map_line, (70, 410), (180, 335), 2)
    pygame.draw.line(surface, theme.map_line, (180, 335), (295, 350), 2)
    pygame.draw.line(surface, theme.map_line, (295, 350), (430, 265), 2)
    pygame.draw.line(surface, theme.map_line, (430, 265), (585, 290), 2)


def draw_current(surface, fonts: Fonts, theme: Theme, s: WeatherSnapshot, cfg: AppConfig, now: datetime, anim: float) -> None:
    surface.fill(theme.bg)
    draw_header(surface, fonts, theme, s, now, cfg.data.stale_after_seconds)
    text(surface, fonts, f"{s.observation.temperature_f:.0f}°", (32, 70), "huge", theme.text)
    text(surface, fonts, s.observation.condition.upper(), (34, 167), "lg", theme.muted)
    text(surface, fonts, f"FEELS {s.observation.feels_like_f:.0f}°", (36, 226), "md", theme.text)
    text(surface, fonts, f"WIND {s.observation.wind_direction} {s.observation.wind_mph:.0f} MPH", (36, 264), "md", theme.text)
    text(surface, fonts, f"HUMIDITY {s.observation.humidity_pct}%", (36, 302), "md", theme.text)
    pygame.draw.rect(surface, theme.panel, (28, 357, 584, 88), border_radius=10)
    headline = current_intelligence(s)
    text(surface, fonts, headline, (320, 375), "lg" if len(headline) < 26 else "md", theme.accent, "center")


def draw_radar(surface, fonts: Fonts, theme: Theme, s: WeatherSnapshot, cfg: AppConfig, now: datetime, anim: float) -> None:
    _map_background(surface, theme)
    draw_header(surface, fonts, theme, s, now, cfg.data.stale_after_seconds)
    text(surface, fonts, "RADAR", (26, 62), "sm", theme.text)
    for cell in s.radar_cells:
        x = cell.x + (anim % 4.0 - 2.0) * cell.vx
        y = cell.y + (anim % 4.0 - 2.0) * cell.vy
        base = theme.heavy_rain if cell.intensity > 0.8 else theme.rain
        for factor, alpha in ((1.0, 70), (0.72, 105), (0.45, 165)):
            layer = pygame.Surface((640, 480), pygame.SRCALPHA)
            pygame.draw.circle(layer, (*base, alpha), (int(x), int(y)), int(cell.radius * factor))
            surface.blit(layer, (0, 0))
        pygame.draw.line(surface, theme.muted, (int(x), int(y)), (int(x + cell.vx * 2), int(y + cell.vy * 2)), 2)
    draw_location_marker(surface, theme)
    if s.rain_eta_minutes is not None:
        label = "RAIN NOW" if s.rain_eta_minutes <= 0 else f"RAIN ~{s.rain_eta_minutes} MIN"
        pygame.draw.rect(surface, theme.panel, (430, 405, 175, 38), border_radius=6)
        text(surface, fonts, label, (594, 414), "sm", theme.accent, "right")


def draw_rain_arrival(surface, fonts: Fonts, theme: Theme, s: WeatherSnapshot, cfg: AppConfig, now: datetime, anim: float) -> None:
    surface.fill(theme.bg)
    draw_header(surface, fonts, theme, s, now, cfg.data.stale_after_seconds)
    h1, h2 = rain_arrival_headline(s)
    text(surface, fonts, h1, (320, 78), "xl", theme.rain, "center")
    text(surface, fonts, h2, (320, 145), "huge", theme.text, "center")
    x0, y0, width = 55, 300, 530
    pygame.draw.line(surface, theme.map_line, (x0, y0), (x0 + width, y0), 4)
    labels = ["NOW", "+30M", "+1H", "+2H"]
    probs = [20, 80, 90, 45]
    for i, label in enumerate(labels):
        x = x0 + i * (width // 3)
        pygame.draw.circle(surface, theme.rain if probs[i] >= 60 else theme.muted, (x, y0), 8)
        text(surface, fonts, label, (x, y0 + 22), "sm", theme.text, "center")
        intensity = "HEAVY" if probs[i] >= 90 and (s.rain_intensity or "") == "heavy" else "MOD" if probs[i] >= 70 else "LIGHT" if probs[i] >= 40 else "NONE"
        text(surface, fonts, intensity, (x, y0 + 52), "xs", theme.rain if intensity != "NONE" else theme.muted, "center")


def draw_forecast(surface, fonts: Fonts, theme: Theme, s: WeatherSnapshot, cfg: AppConfig, now: datetime, anim: float) -> None:
    surface.fill(theme.bg)
    draw_header(surface, fonts, theme, s, now, cfg.data.stale_after_seconds)
    text(surface, fonts, "NEXT HOURS", (26, 62), "sm", theme.muted)
    points = s.hourly[:6]
    if not points:
        text(surface, fonts, "FORECAST UNAVAILABLE", (320, 210), "lg", theme.muted, "center")
        return
    col_w = 600 // len(points)
    for i, point in enumerate(points):
        x = 20 + i * col_w
        if i % 2 == 0:
            pygame.draw.rect(surface, theme.panel, (x, 100, col_w - 5, 270), border_radius=8)
        label = "NOW" if i == 0 else point.at.astimezone().strftime("%-I%p")
        text(surface, fonts, label, (x + col_w // 2, 116), "sm", theme.muted, "center")
        text(surface, fonts, f"{point.temperature_f:.0f}°", (x + col_w // 2, 165), "lg", theme.text, "center")
        icon = "RAIN" if point.rain_probability_pct >= 60 else "CLD" if "cloud" in point.condition.lower() else "CLR"
        text(surface, fonts, icon, (x + col_w // 2, 235), "sm", theme.rain if icon == "RAIN" else theme.accent, "center")
        text(surface, fonts, f"{point.rain_probability_pct}%", (x + col_w // 2, 290), "md", theme.rain if point.rain_probability_pct >= 50 else theme.muted, "center")
    text(surface, fonts, current_intelligence(s), (320, 402), "md", theme.accent, "center")


def draw_clouds(surface, fonts: Fonts, theme: Theme, s: WeatherSnapshot, cfg: AppConfig, now: datetime, anim: float) -> None:
    _map_background(surface, theme)
    draw_header(surface, fonts, theme, s, now, cfg.data.stale_after_seconds)
    text(surface, fonts, "CLOUDS", (26, 62), "sm", theme.text)
    layer = pygame.Surface((640, 480), pygame.SRCALPHA)
    for band in s.cloud_bands:
        x = band.x + (anim * band.vx) % 850 - 210
        pygame.draw.ellipse(layer, (*theme.cloud, 105), (x, band.y, band.width, band.height))
        pygame.draw.ellipse(layer, (*theme.cloud, 65), (x - 55, band.y + 25, band.width * 0.9, band.height * 0.8))
    surface.blit(layer, (0, 0))
    draw_location_marker(surface, theme)
    pygame.draw.rect(surface, theme.panel, (110, 385, 420, 56), border_radius=8)
    text(surface, fonts, cloud_headline(s), (320, 398), "lg", theme.text, "center")


def draw_lightning(surface, fonts: Fonts, theme: Theme, s: WeatherSnapshot, cfg: AppConfig, now: datetime, anim: float) -> None:
    _map_background(surface, theme)
    draw_header(surface, fonts, theme, s, now, cfg.data.stale_after_seconds)
    h1, h2 = lightning_headline(s)
    text(surface, fonts, h1, (28, 62), "sm", theme.lightning)
    text(surface, fonts, h2, (600, 62), "sm", theme.text, "right")
    draw_location_marker(surface, theme)
    for strike in s.lightning:
        age = max(0.0, (datetime.now(timezone.utc) - strike.occurred_at).total_seconds())
        alpha = max(45, int(255 - age * 1.8))
        dx = (strike.location.longitude - s.location.longitude) * 48
        dy = (s.location.latitude - strike.location.latitude) * 58
        x, y = int(320 + dx * 10), int(256 + dy * 10)
        layer = pygame.Surface((640, 480), pygame.SRCALPHA)
        pygame.draw.circle(layer, (*theme.lightning, alpha), (x, y), 5)
        pygame.draw.line(layer, (*theme.lightning, alpha), (x, y - 11), (x - 4, y + 2), 2)
        pygame.draw.line(layer, (*theme.lightning, alpha), (x - 4, y + 2), (x + 4, y), 2)
        pygame.draw.line(layer, (*theme.lightning, alpha), (x + 4, y), (x, y + 12), 2)
        surface.blit(layer, (0, 0))
    nearest = s.nearest_lightning_miles()
    if nearest is not None and nearest <= cfg.thresholds.lightning_warning_miles:
        pygame.draw.rect(surface, theme.danger, (140, 395, 360, 48), border_radius=7)
        text(surface, fonts, "LIGHTNING SAFETY RANGE", (320, 406), "md", theme.text, "center")


def draw_severe(surface, fonts: Fonts, theme: Theme, s: WeatherSnapshot, cfg: AppConfig, now: datetime, anim: float) -> None:
    alert = s.most_severe_alert()
    surface.fill(theme.bg)
    draw_header(surface, fonts, theme, s, now, cfg.data.stale_after_seconds)
    if not alert:
        text(surface, fonts, "NO ACTIVE WARNINGS", (320, 200), "xl", theme.muted, "center")
        return
    color = theme.danger if alert.severity in {Severity.WARNING, Severity.EXTREME} else theme.warning
    pygame.draw.rect(surface, color, (0, 42, 640, 92))
    text(surface, fonts, alert.event.upper(), (320, 58), "lg", theme.text, "center")
    if alert.distance_miles is not None:
        text(surface, fonts, f"{alert.distance_miles:.1f} MI AWAY", (35, 160), "xl", theme.text)
    if alert.motion:
        text(surface, fonts, alert.motion, (35, 224), "md", theme.accent)
    pygame.draw.rect(surface, theme.panel, (330, 154, 275, 215), border_radius=8)
    if alert.polygon_offsets:
        pts = [(468 + int(x * 0.9), 262 + int(y * 0.8)) for x, y in alert.polygon_offsets]
        pygame.draw.polygon(surface, color, pts, 3)
        draw_location_marker(surface, theme, 468, 262)
    text(surface, fonts, alert.headline.upper(), (35, 302), "md", theme.warning)
    text(surface, fonts, f"SOURCE: {alert.source.upper()}", (35, 410), "xs", theme.muted)


def draw_tropical(surface, fonts: Fonts, theme: Theme, s: WeatherSnapshot, cfg: AppConfig, now: datetime, anim: float) -> None:
    surface.fill(theme.bg)
    draw_header(surface, fonts, theme, s, now, cfg.data.stale_after_seconds)
    if not s.tropical:
        text(surface, fonts, "NO RELEVANT TROPICAL SYSTEM", (320, 210), "lg", theme.muted, "center")
        return
    storm = min(s.tropical, key=lambda item: item.distance_miles)
    text(surface, fonts, f"{storm.classification} {storm.name}", (24, 67), "lg", theme.text)
    category = f"CATEGORY {storm.category}" if storm.category is not None else storm.classification
    text(surface, fonts, category, (26, 112), "md", theme.warning)
    text(surface, fonts, f"{storm.distance_miles:.0f} MI AWAY", (26, 170), "xl", theme.text)
    text(surface, fonts, f"MOVING {storm.movement}", (26, 230), "md", theme.accent)
    text(surface, fonts, f"CLOSEST {storm.closest_approach}", (26, 270), "md", theme.text)
    pygame.draw.rect(surface, theme.panel, (365, 78, 245, 300), border_radius=8)
    center = (485, 310)
    if storm.track_offsets:
        pts = [(center[0] + int(x * 0.45), center[1] - int(y * 0.45)) for x, y in storm.track_offsets]
        if len(pts) >= 3:
            cone = [(pts[0][0] - 40, pts[0][1] + 20)] + pts + [(pts[0][0] + 40, pts[0][1] + 20)]
            layer = pygame.Surface((640, 480), pygame.SRCALPHA)
            pygame.draw.polygon(layer, (*theme.muted, 45), cone)
            surface.blit(layer, (0, 0))
        pygame.draw.lines(surface, theme.warning, False, pts, 3)
        for idx, point in enumerate(pts):
            pygame.draw.circle(surface, theme.text if idx else theme.warning, point, 5)
    draw_location_marker(surface, theme, 485, 185)
    if storm.watches_warnings:
        text(surface, fonts, storm.watches_warnings[0], (26, 405), "sm", theme.warning)
    text(surface, fonts, "CONE = TRACK UNCERTAINTY, NOT STORM SIZE", (600, 409), "xs", theme.muted, "right")


DRAWERS = {
    View.CURRENT: draw_current,
    View.RADAR: draw_radar,
    View.RAIN_ARRIVAL: draw_rain_arrival,
    View.FORECAST: draw_forecast,
    View.CLOUDS: draw_clouds,
    View.LIGHTNING: draw_lightning,
    View.SEVERE: draw_severe,
    View.TROPICAL: draw_tropical,
}
