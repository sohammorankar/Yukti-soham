"""Decimal-safe money utilities for YuktiCart.

Rounding rule (documented, used consistently):
- All internal arithmetic is performed with Python's Decimal type at paise precision.
- Totals are always computed from exact decimal component values, never from
  pre-rounded intermediate values.
- For DISPLAY only, amounts are rounded to the nearest whole rupee using
  ROUND_HALF_UP (standard commercial rounding). e.g. 52.50 -> 53, 87.50 -> 88.
- APIs return BOTH the exact decimal (as a string, full paise) and the
  rounded-for-display integer so the client never has to re-round.
"""
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

TWO_PLACES = Decimal("0.01")
ZERO = Decimal("0")


def D(value) -> Decimal:
    """Coerce anything to a Decimal safely (via str to avoid float error)."""
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return ZERO


def q(value) -> Decimal:
    """Quantize to 2 decimal places (paise) for internal exact representation."""
    return D(value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def round_rupee(value) -> int:
    """Round to nearest whole rupee, ROUND_HALF_UP, for presentation only."""
    return int(D(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def money_out(value):
    """Return a display bundle for a monetary value.

    exact: string with full paise (e.g. "52.50")
    rupees: int rounded to nearest rupee for headline display (e.g. 53)
    """
    exact = q(value)
    return {"exact": str(exact), "rupees": round_rupee(exact)}
