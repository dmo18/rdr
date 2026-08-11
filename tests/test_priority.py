from rdr.config import AppConfig
from rdr.models import View
from rdr.priority import build_view_plan, rotation_sequence
from rdr.providers.mock import MockWeatherProvider


def plan(scenario: str):
    cfg = AppConfig()
    snapshot = MockWeatherProvider(scenario).fetch(cfg)
    return build_view_plan(snapshot, cfg)


def test_clear_rotation_starts_current():
    assert plan("clear")[0].view == View.CURRENT


def test_rain_promotes_arrival_screen():
    assert plan("approaching-rain")[0].view == View.RAIN_ARRIVAL


def test_tornado_overrides_normal_rotation():
    assert plan("tornado-warning")[0].view == View.SEVERE
    assert rotation_sequence(
        MockWeatherProvider("tornado-warning").fetch(AppConfig()), AppConfig()
    )[0].priority >= 120


def test_hurricane_screen_only_when_relevant():
    views = [item.view for item in plan("hurricane-approaching")]
    assert View.TROPICAL in views
    clear_views = [item.view for item in plan("clear")]
    assert View.TROPICAL not in clear_views
