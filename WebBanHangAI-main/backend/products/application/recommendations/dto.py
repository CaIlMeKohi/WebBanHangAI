from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ForYouQueryDTO:
    user_id: str | None = None
    session_id: str | None = None
    search: str | None = None
    limit: int = 8

    @classmethod
    def from_query_params(cls, params: Any) -> 'ForYouQueryDTO':
        try:
            limit = int(params.get('limit', 8))
        except (TypeError, ValueError):
            limit = 8
        return cls(
            user_id=params.get('user_id'),
            session_id=params.get('session_id'),
            search=params.get('search'),
            limit=max(1, min(limit, 32)),
        )


@dataclass(frozen=True)
class RelatedProductsQueryDTO:
    product_id: str
    limit: int = 4

    @classmethod
    def from_query_params(cls, product_id: str, params: Any) -> 'RelatedProductsQueryDTO':
        try:
            limit = int(params.get('limit', 4))
        except (TypeError, ValueError):
            limit = 4
        return cls(product_id=str(product_id), limit=max(1, min(limit, 24)))


@dataclass(frozen=True)
class RunRecommendationDTO:
    top_n: int = 10
    cold_start_threshold: int = 5

    @classmethod
    def from_payload(cls, payload: Any) -> 'RunRecommendationDTO':
        return cls(
            top_n=max(1, min(int(payload.get('top_n', 10)), 100)),
            cold_start_threshold=max(1, min(int(payload.get('cold_start_threshold', 5)), 100)),
        )


@dataclass(frozen=True)
class RecommendationMetricsDTO:
    from_date: str | None = None
    to_date: str | None = None

    @classmethod
    def from_query_params(cls, params: Any) -> 'RecommendationMetricsDTO':
        return cls(from_date=params.get('from_date'), to_date=params.get('to_date'))
