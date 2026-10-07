"""Phase-2 focused tests: affiliate category grouping + public support/contact surfaces.

These tests are read-only and DB-write free.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import importlib.util
import sys

import pytest


@pytest.fixture
def server_module(monkeypatch):
    monkeypatch.setenv("MONGO_URL", "mongodb://localhost:27017")
    monkeypatch.setenv("DB_NAME", "test")
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    module_path = "/app/backend/server.py"
    if "/app/backend" not in sys.path:
        sys.path.insert(0, "/app/backend")
    spec = importlib.util.spec_from_file_location("server", module_path)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod


def _match_query(row: dict, query: dict) -> bool:
    for key, value in (query or {}).items():
        if isinstance(value, dict):
            # Only simple exact-match queries are used by this test target.
            return False
        if row.get(key) != value:
            return False
    return True


class _AsyncIterCursor:
    def __init__(self, rows):
        self._rows = list(rows)
        self._idx = 0

    def __aiter__(self):
        self._idx = 0
        return self

    async def __anext__(self):
        if self._idx >= len(self._rows):
            raise StopAsyncIteration
        row = self._rows[self._idx]
        self._idx += 1
        return dict(row)


class _FakeRateCards:
    def __init__(self, rows):
        self._rows = list(rows)

    def find(self, query=None, _projection=None):
        filtered = [dict(row) for row in self._rows if _match_query(row, query or {})]
        return _AsyncIterCursor(filtered)


class _FakeDb:
    def __init__(self, rate_rows):
        self.rate_cards = _FakeRateCards(rate_rows)


def _rule(store_id, category, customer_type="both", platform_id="p1", value="6"):
    today = datetime.now(timezone.utc).date().isoformat()
    return {
        "id": f"r-{store_id}-{category}-{customer_type}-{platform_id}-{value}",
        "store_id": store_id,
        "platform_kind": "affiliate",
        "platform_id": platform_id,
        "category_name": category,
        "customer_type": customer_type,
        "active": True,
        "status": "published",
        "archived_at": None,
        "value_type": "percent",
        "value": value,
        "minimum_order_value": "0",
        "maximum_cashback_amount": "500",
        "cashback_cap_amount": None,
        "maximum_eligible_amount": None,
        "valid_from": today,
        "valid_until": today,
        "priority": 1,
        "product_match": "any",
        "card_eligibility": "any",
        "card_criteria": None,
    }


# --- Affiliate category grouping behavior ---
def test_equivalent_profiles_group_together(server_module, monkeypatch):
    # Beauty 6 / Personal Care 6 / Healthcare 6 equivalent profiles => one display group
    rows = []
    for cat in ("Beauty", "Personal Care", "Healthcare"):
        for p in ("p1", "p2", "p3", "p4", "p5", "p6"):
            rows.append(_rule("s1", cat, "both", platform_id=p, value="6"))
    monkeypatch.setattr(server_module, "db", _FakeDb(rows))

    _, _, categories, groups = asyncio.run(server_module._store_affiliate_summary("s1"))
    category_names = sorted([c["name"] for c in categories["s1"].values()])
    assert category_names == ["Beauty", "Healthcare", "Personal Care"]
    assert len(groups["s1"]) == 1
    grouped_names = sorted([c["name"] for c in groups["s1"][0]["categories"]])
    assert grouped_names == ["Beauty", "Healthcare", "Personal Care"]


def test_split_profiles_group_only_equivalents(server_module, monkeypatch):
    # Beauty + Personal Care equivalent; Healthcare differs => split into two groups
    rows = []
    for p in ("p1", "p2", "p3", "p4", "p5", "p6"):
        rows.append(_rule("s1", "Beauty", "both", platform_id=p, value="6"))
        rows.append(_rule("s1", "Personal Care", "both", platform_id=p, value="6"))
        rows.append(_rule("s1", "Healthcare", "both", platform_id=p, value="4"))
    monkeypatch.setattr(server_module, "db", _FakeDb(rows))

    _, _, _, groups = asyncio.run(server_module._store_affiliate_summary("s1"))
    normalized = sorted(sorted(c["name"] for c in g["categories"]) for g in groups["s1"])
    assert normalized == [["Beauty", "Personal Care"], ["Healthcare"]]


def test_all_footwear_visible_but_internal_all_hidden(server_module, monkeypatch):
    rows = [
        _rule("s1", "All", "existing", platform_id="p1", value="3"),
        _rule("s1", "All Footwear", "existing", platform_id="p1", value="3"),
    ]
    monkeypatch.setattr(server_module, "db", _FakeDb(rows))

    _, _, categories, groups = asyncio.run(server_module._store_affiliate_summary("s1"))
    category_names = [c["name"] for c in categories["s1"].values()]
    assert "All" not in category_names
    assert "All Footwear" in category_names
    grouped_names = [c["name"] for g in groups["s1"] for c in g["categories"]]
    assert "All" not in grouped_names
    assert "All Footwear" in grouped_names


def test_gift_card_only_categories_excluded(server_module, monkeypatch):
    # gift_card rows must not contribute to affiliate categories/groups
    gift_only = [
        {
            **_rule("s2", "Gift Cards Promo", "both", platform_id="g1", value="10"),
            "platform_kind": "gift_card",
        }
    ]
    monkeypatch.setattr(server_module, "db", _FakeDb(gift_only))

    category_flags, _, categories, groups = asyncio.run(server_module._store_affiliate_summary("s2"))
    assert not category_flags.get("s2")
    assert categories.get("s2", {}) == {}
    assert groups.get("s2", []) == []


def test_both_rule_participates_in_new_and_existing(server_module, monkeypatch):
    # Category A uses one BOTH rule; Category B uses equivalent explicit NEW + EXISTING rules.
    rows = [
        _rule("s3", "Beauty", "both", platform_id="p1", value="6"),
        _rule("s3", "Personal Care", "new", platform_id="p1", value="6"),
        _rule("s3", "Personal Care", "existing", platform_id="p1", value="6"),
    ]
    monkeypatch.setattr(server_module, "db", _FakeDb(rows))

    _, _, _, groups = asyncio.run(server_module._store_affiliate_summary("s3"))
    assert len(groups["s3"]) == 1
    grouped_names = sorted([c["name"] for c in groups["s3"][0]["categories"]])
    assert grouped_names == ["Beauty", "Personal Care"]


# --- Public support/contact source assertions ---
def test_whatsapp_link_and_message_present_in_nav_source():
    nav = open("/app/frontend/src/components/site/Nav.jsx", "r", encoding="utf-8").read()
    assert "https://wa.me/919156968318" in nav
    assert "Hello YuktiCart Support, I need help." in nav
    assert 'aria-label="Chat with YuktiCart Support on WhatsApp"' in nav


def test_public_contact_emails_point_only_to_yukticart_gmail():
    files = [
        "/app/frontend/src/components/site/Footer.jsx",
        "/app/frontend/src/pages/FeedbackPage.jsx",
    ]
    text = "\n".join(open(path, "r", encoding="utf-8").read() for path in files)

    assert "mailto:yukticart@gmail.com" in text
    forbidden = [
        "hello@yukticart",
        "support@yukticart",
        "contact@yukticart",
        "help@yukticart",
    ]
    for old in forbidden:
        assert old not in text
