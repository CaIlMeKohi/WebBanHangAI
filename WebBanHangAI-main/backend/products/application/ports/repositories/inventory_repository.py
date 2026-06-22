from __future__ import annotations

from typing import Any, Protocol


class InventoryRepository(Protocol):
    def adjust_variant_stock(self, actor: Any, payload: Any) -> Any:
        ...

    def list_low_stock(self) -> list[dict]:
        ...

    def list_stock_variants(self) -> list[dict]:
        ...
