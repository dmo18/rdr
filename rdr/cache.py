from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Generic, TypeVar

T = TypeVar("T")


@dataclass
class CacheEntry(Generic[T]):
    value: T
    stored_at: datetime


class MemoryCache:
    def __init__(self) -> None:
        self._items: dict[str, CacheEntry[object]] = {}

    def put(self, key: str, value: T) -> None:
        self._items[key] = CacheEntry(value=value, stored_at=datetime.now(timezone.utc))

    def get(self, key: str) -> T | None:
        entry = self._items.get(key)
        return entry.value if entry else None
