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
            'amount': dto.amount,
            'payment_link_id': dto.payment_link_id,
            'raw_payload': dto.raw_payload or {},
        })


class GetPaymentStatusUseCase:
    def __init__(self, repository: PaymentRepository):
        self.repository = repository

    def execute(self, user, order_id: int):
        return self.repository.get_payment_status(user, order_id)


class SwitchPaymentToCODUseCase:
    def __init__(self, repository: PaymentRepository):
        self.repository = repository

    def execute(self, user, order_id: int):
        return self.repository.switch_to_cod(user, order_id)


class ReorderAsCODUseCase:
    def __init__(self, repository: PaymentRepository):
        self.repository = repository

    def execute(self, user, order_id: int):
        return self.repository.reorder_as_cod(user, order_id)
