from __future__ import annotations

from dataclasses import dataclass
from datetime import date
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

        group_by = str(params.get('group_by', 'day') or 'day').strip().lower()
        if group_by not in {'day', 'month', 'quarter'}:
            group_by = 'day'

        from_date = _normalize_date(params.get('from_date'))
        to_date = _normalize_date(params.get('to_date'))
        return cls(
            from_date=from_date,
            to_date=to_date,
            group_by=group_by,
            top=top,
        )


def _normalize_date(value: Any) -> str | None:
    if value in (None, ''):
        return None
    raw = str(value).strip()
    try:
        return date.fromisoformat(raw[:10]).isoformat()
    except (TypeError, ValueError):
        return None
