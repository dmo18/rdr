from __future__ import annotations

import argparse
import logging

from .app import WeatherDisplayApp
from .config import load_config
from .providers.mock import MockWeatherProvider, SCENARIOS


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="640x480 unattended weather instrument")
    parser.add_argument("--config", default=None, help="Path to TOML configuration")
    parser.add_argument("--scenario", choices=SCENARIOS, default="clear", help="Simulation scenario")
    parser.add_argument("--log-level", default="INFO", choices=("DEBUG", "INFO", "WARNING", "ERROR"))
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    config = load_config(args.config)
    provider = MockWeatherProvider(args.scenario)
    app = WeatherDisplayApp(config, provider, args.scenario)
    return app.run()


if __name__ == "__main__":
    raise SystemExit(main())
