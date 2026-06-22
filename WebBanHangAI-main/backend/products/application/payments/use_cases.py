from __future__ import annotations

from products.application.payments.dto import CreatePaymentDTO, PaymentCallbackDTO
from products.application.ports.repositories.payment_repository import PaymentRepository


class CreatePaymentUseCase:
    def __init__(self, repository: PaymentRepository):
        self.repository = repository

    def execute(self, user, dto: CreatePaymentDTO):
        return self.repository.create_payment(user, {'order_id': dto.order_id, 'method': dto.method})


class HandlePaymentCallbackUseCase:
    def __init__(self, repository: PaymentRepository):
        self.repository = repository

    def execute(self, provider: str, dto: PaymentCallbackDTO) -> None:
        self.repository.handle_callback(provider, {
            'order_id': dto.order_id,
            'success': dto.success,
            'transaction_id': dto.transaction_id,
            'raw_payload': dto.raw_payload or {},
        })
