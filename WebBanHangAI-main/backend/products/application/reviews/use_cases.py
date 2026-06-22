from __future__ import annotations

from products.application.ports.repositories.review_repository import ReviewRepository
from products.application.reviews.dto import CreateReviewDTO, ModerateReviewDTO


class CreateReviewUseCase:
    def __init__(self, repository: ReviewRepository):
        self.repository = repository

    def execute(self, customer, dto: CreateReviewDTO) -> int:
        return self.repository.create_review(customer, {
            'order_item_id': dto.order_item_id,
            'product_id': dto.product_id,
            'rating': dto.rating,
            'comment': dto.comment,
            'images': dto.images,
        })


class ListProductReviewsUseCase:
    def __init__(self, repository: ReviewRepository):
        self.repository = repository

    def execute(self, product_id: int):
        return self.repository.list_product_reviews(product_id)


class ListStaffReviewsUseCase:
    def __init__(self, repository: ReviewRepository):
        self.repository = repository

    def execute(self, status: str | None = None):
        return self.repository.list_staff_reviews(status)


class ModerateReviewUseCase:
    def __init__(self, repository: ReviewRepository):
        self.repository = repository

    def execute(self, staff, review_id: int, dto: ModerateReviewDTO) -> None:
        self.repository.moderate_review(staff, review_id, dto.action, dto.reason)


class DeleteReviewUseCase:
    def __init__(self, repository: ReviewRepository):
        self.repository = repository

    def execute(self, actor, review_id: int) -> None:
        self.repository.delete_review(actor, review_id)
