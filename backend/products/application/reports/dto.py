from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ReportQueryDTO:
    from_date: str | None = None
    to_date: str | None = None
    group_by: str = 'day'
    top: int = 20

    @classmethod
    def from_query_params(cls, params: Any) -> 'ReportQueryDTO':
        try:
            top = int(params.get('top', 20))
        except (TypeError, ValueError):
            top = 20
        return cls(
            from_date=params.get('from_date'),
            to_date=params.get('to_date'),
            group_by=params.get('group_by', 'day'),
            top=top,
        )
