from __future__ import annotations

from products.application.ports.repositories.recommendation_repository import RecommendationRepository
from products.application.recommendations.dto import (
    ForYouQueryDTO,
    RecommendationMetricsDTO,
    RelatedProductsQueryDTO,
    RunRecommendationDTO,
)


class GetForYouRecommendationsUseCase:
    def __init__(self, repository: RecommendationRepository):
        self.repository = repository

    def execute(self, dto: ForYouQueryDTO):
        products = self.repository.for_you(dto.user_id, dto.session_id, dto.limit, dto.search)
        self.repository.log_for_you_impressions(dto.user_id, dto.session_id, products)
        return products


class GetRelatedProductsUseCase:
    def __init__(self, repository: RecommendationRepository):
        self.repository = repository

    def execute(self, dto: RelatedProductsQueryDTO):
        return self.repository.related_products(dto.product_id, dto.limit)


class RunRecommendationBatchUseCase:
    def __init__(self, repository: RecommendationRepository):
        self.repository = repository

    def execute(self, dto: RunRecommendationDTO):
        return self.repository.run_batch(dto.top_n, dto.cold_start_threshold)


class GetRecommendationMetricsUseCase:
    def __init__(self, repository: RecommendationRepository):
        self.repository = repository

    def execute(self, dto: RecommendationMetricsDTO):
        metrics = self.repository.metrics(dto.from_date, dto.to_date)
        if 'ctr_percent' in metrics and 'ctr' not in metrics:
            metrics['ctr'] = float(metrics['ctr_percent'] or 0) / 100
        return metrics


class RecordRecommendationEventUseCase:
    def __init__(self, repository: RecommendationRepository):
        self.repository = repository

    def execute(self, user, product_id: int, event_type: str) -> None:
        self.repository.record_event(user, product_id, event_type)
