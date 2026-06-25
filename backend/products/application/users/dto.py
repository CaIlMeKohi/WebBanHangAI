from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class AdminUserUpdateDTO:
    values: dict[str, Any]


@dataclass(frozen=True)
class CreateStaffOrAdminDTO:
    payload: dict[str, Any]
