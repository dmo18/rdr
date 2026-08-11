from rdr.config import AppConfig
from rdr.interpretation import current_intelligence
from rdr.providers.mock import MockWeatherProvider


def snap(name: str):
    return MockWeatherProvider(name).fetch(AppConfig())


def test_rain_is_expressed_as_estimate():
    assert current_intelligence(snap("approaching-rain")) == "RAIN IN ~18 MIN"


def test_warning_beats_rain():
    assert current_intelligence(snap("tornado-warning")) == "TORNADO WARNING"


def test_clear_has_simple_statement():
    assert current_intelligence(snap("clear")) == "CLEAR FOR NEXT FEW HOURS"
