"""Phase 2 limited smoke: pure engine function checks (no DB writes)."""

from datetime import date, timedelta
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from engine import apply_rate, best_rule_for_side, rate_is_eligible


def test_apply_rate_respects_eligible_spend_cap_before_percent():
    # cap defect check: 10% on eligible spend cap 1000 from price 5000 => 100
    rate = {
        "platform_kind": "affiliate",
        "value_type": "percent",
        "value": "10",
        "maximum_eligible_amount": "1000",
        "maximum_cashback_amount": "500",
    }
    saving, applied_to = apply_rate(rate, 5000)
    assert str(applied_to) == "1000.00"
    assert str(saving) == "100.00"


def test_optional_category_pending_blocks_same_partner_all_fallback():
    # optional category must not let same-partner catch-all bypass unknown category specifics
    rules = [
        {
            "id": "r_all",
            "platform_id": "p1",
            "platform_name": "CashKaro",
            "category_name": "All",
            "value_type": "percent",
            "value": "5",
            "customer_type": "existing",
            "active": True,
        },
        {
            "id": "r_zero_electronics",
            "platform_id": "p1",
            "platform_name": "CashKaro",
            "category_name": "Electronics",
            "value_type": "percent",
            "value": "0",
            "customer_type": "existing",
            "active": True,
        },
    ]

    winner, evaluated = best_rule_for_side(
        rules,
        price=5000,
        product_category=None,
        customer_type="existing",
    )

    assert winner is None
    all_entry = next(e for e in evaluated if e["rate"]["id"] == "r_all")
    assert all_entry["eligible"] is False
    assert any("Category needed" in reason for reason in all_entry["reasons"])


def test_product_specific_zero_rate_with_matching_url_stays_zero():
    # direct product-specific zero should beat generic same-partner positive cashback
    rules = [
        {
            "id": "r_all_positive",
            "platform_id": "p2",
            "platform_name": "PartnerX",
            "category_name": "All",
            "value_type": "percent",
            "value": "7",
            "customer_type": "existing",
            "active": True,
        },
        {
            "id": "r_product_zero",
            "platform_id": "p2",
            "platform_name": "PartnerX",
            "category_name": "All",
            "product_match": "iphone 15",
            "value_type": "percent",
            "value": "0",
            "customer_type": "existing",
            "active": True,
        },
    ]

    winner, evaluated = best_rule_for_side(
        rules,
        price=5000,
        product_category="All",
        customer_type="existing",
        product_url="https://example.com/apple-iphone-15-pro",
    )

    assert winner is not None
    assert winner["rate"]["id"] == "r_product_zero"
    assert str(winner["saving"]) == "0.00"
    generic = next(e for e in evaluated if e["rate"]["id"] == "r_all_positive")
    assert generic["eligible"] is False
    assert any("Superseded by a more specific zero-rate exclusion" in reason for reason in generic["reasons"])


def test_mov_and_date_guard():
    # one MOV/date guard check (convenience)
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    last_week = (date.today() - timedelta(days=7)).isoformat()
    rate = {
        "active": True,
        "category_name": "All",
        "value_type": "percent",
        "value": "5",
        "minimum_order_value": "5000",
        "valid_from": last_week,
        "valid_until": yesterday,
        "customer_type": "existing",
    }
    eligible, reasons = rate_is_eligible(rate, price=4999, customer_type="existing")
    assert eligible is False
    assert any("below minimum order value" in r.lower() for r in reasons)
    assert any("expired" in r.lower() for r in reasons)
