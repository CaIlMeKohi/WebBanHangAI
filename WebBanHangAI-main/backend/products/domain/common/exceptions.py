from __future__ import annotations


class DomainError(Exception):
    """Base exception for business/domain errors."""


class NotFoundError(DomainError):
    """Raised when a requested business object cannot be found."""


class ValidationError(DomainError):
    """Raised when input data violates business validation."""


class PermissionDeniedError(DomainError):
    """Raised when the current actor cannot perform an action."""


class BusinessRuleViolation(DomainError):
    """Raised when a business rule prevents an otherwise valid action."""


class EmailDeliveryError(DomainError):
    """Raised when the configured email provider cannot deliver a message."""
