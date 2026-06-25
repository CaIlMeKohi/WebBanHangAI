from __future__ import annotations

from dataclasses import dataclass
from typing import Generic, TypeVar


T = TypeVar('T')


@dataclass(frozen=True)
class AppResult(Generic[T]):
    value: T | None = None
    error: str | None = None

    @property
    def is_success(self) -> bool:
        return self.error is None

    @classmethod
    def ok(cls, value: T) -> 'AppResult[T]':
        return cls(value=value)

    @classmethod
    def fail(cls, error: str) -> 'AppResult[T]':
        return cls(error=error)
