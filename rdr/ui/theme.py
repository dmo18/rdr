from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Theme:
    bg: tuple[int, int, int]
    panel: tuple[int, int, int]
    text: tuple[int, int, int]
    muted: tuple[int, int, int]
    accent: tuple[int, int, int]
    rain: tuple[int, int, int]
    heavy_rain: tuple[int, int, int]
    lightning: tuple[int, int, int]
    warning: tuple[int, int, int]
    danger: tuple[int, int, int]
    map_line: tuple[int, int, int]
    cloud: tuple[int, int, int]


def make_theme(night: bool) -> Theme:
    if night:
        return Theme(
            bg=(4, 8, 12),
            panel=(9, 16, 22),
            text=(214, 224, 231),
            muted=(105, 127, 141),
            accent=(61, 164, 190),
            rain=(41, 112, 192),
            heavy_rain=(119, 71, 179),
            lightning=(216, 181, 66),
            warning=(221, 138, 48),
            danger=(200, 55, 55),
            map_line=(45, 68, 80),
            cloud=(90, 102, 111),
        )
    return Theme(
        bg=(7, 13, 18),
        panel=(13, 23, 31),
        text=(238, 244, 247),
        muted=(137, 159, 172),
        accent=(72, 197, 225),
        rain=(55, 137, 230),
        heavy_rain=(154, 88, 211),
        lightning=(245, 205, 76),
        warning=(243, 154, 52),
        danger=(226, 65, 65),
        map_line=(53, 83, 98),
        cloud=(119, 132, 140),
    )
