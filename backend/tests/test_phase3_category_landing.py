"""Phase-3 focused tests for public homepage category detail endpoint.

Read-only, DB-write free tests using fake collections.
"""

from __future__ import annotations

import asyncio
import importlib.util
import re
import sys
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException


@pytest.fixture
def server_module(monkeypatch):
    # Module-level env required by server import.
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


class _Cursor:
    def __init__(self, rows):
        self.rows = list(rows)

    def sort(self, fields):
        rows = list(self.rows)
        for key, direction in reversed(fields):
            rows.sort(key=lambda r: r.get(key) if r.get(key) is not None else "", reverse=direction < 0)
        self.rows = rows
        return self

    async def to_list(self, _limit):
        return [dict(row) for row in self.rows]


def _match(doc, query):
    for key, value in (query or {}).items():
        if isinstance(value, dict):
            if "$in" in value:
                if doc.get(key) not in value["$in"]:
                    return False
            else:
                return False
        elif isinstance(value, re.Pattern):
            if not value.search(str(doc.get(key, ""))):
                return False
        elif doc.get(key) != value:
            return False
    return True


def _project(doc, projection):
    if not projection:
        return dict(doc)
    include = {k for k, v in projection.items() if v == 1}
    if include:
        return {k: doc.get(k) for k in include}
    return dict(doc)


class _FakeCollection:
    def __init__(self, rows):
        self.rows = list(rows)

    async def find_one(self, query, projection=None):
        for row in self.rows:
            if _match(row, query):
                return _project(row, projection)
        return None

    def find(self, query=None, projection=None):
        out = [_project(r, projection) for r in self.rows if _match(r, query or {})]
        return _Cursor(out)


class _FakeDb:
    def __init__(self, homepage_categories, rate_cards, stores):
        self.homepage_categories = _FakeCollection(homepage_categories)
        self.rate_cards = _FakeCollection(rate_cards)
        self.stores = _FakeCollection(stores)


def _iso(days=0):
    return (datetime.now(timezone.utc).date() + timedelta(days=days)).isoformat()


def _rule(store_id, category_name, **overrides):
    base = {
        "store_id": store_id,
        "category_name": category_name,
        "platform_kind": "affiliate",
        "active": True,
        "status": "published",
        "archived_at": None,
        "valid_from": _iso(-1),
        "valid_until": _iso(1),
    }
    base.update(overrides)
    return base


# --- /api/public/homepage/categories/{slug} endpoint behavior ---
def test_category_detail_returns_only_current_exact_affiliate_stores_sorted(server_module, monkeypatch):
    homepage_categories = [{"id": "c1", "name": "Beauty", "slug": "beauty", "active": True, "image_url": None, "display_rank": 1}]
    rate_cards = [
        _rule("s2", "beauty"),  # case-insensitive exact match
        _rule("s1", "Beauty"),
        _rule("s3", "Beauty", platform_kind="gift_card"),
        _rule("s4", "Beauty", active=False),
        _rule("s5", "Beauty", status="draft"),
        _rule("s6", "Beauty", valid_from=_iso(2), valid_until=_iso(4)),
        _rule("s7", "Beauty and Care"),
    ]
    stores = [
        {"id": "s1", "name": "Amazon", "slug": "amazon", "active": True, "homepage_visible": True, "archived_at": None, "display_rank": 1},
        {"id": "s2", "name": "Myntra", "slug": "myntra", "active": True, "homepage_visible": True, "archived_at": None, "display_rank": 2},
        {"id": "s3", "name": "GiftOnly", "slug": "giftonly", "active": True, "homepage_visible": True, "archived_at": None, "display_rank": 0},
        {"id": "s4", "name": "InactiveRuleStore", "slug": "inactive-rule-store", "active": True, "homepage_visible": True, "archived_at": None, "display_rank": 3},
        {"id": "s5", "name": "DraftRuleStore", "slug": "draft-rule-store", "active": True, "homepage_visible": True, "archived_at": None, "display_rank": 4},
        {"id": "s6", "name": "FutureRuleStore", "slug": "future-rule-store", "active": True, "homepage_visible": True, "archived_at": None, "display_rank": 5},
        {"id": "s7", "name": "FuzzyStore", "slug": "fuzzy-store", "active": True, "homepage_visible": True, "archived_at": None, "display_rank": 6},
    ]
    monkeypatch.setattr(server_module, "db", _FakeDb(homepage_categories, rate_cards, stores))

    data = asyncio.run(server_module.public_homepage_category_detail("beauty"))
    assert data["category"]["name"] == "Beauty"
    # Sorted by display_rank then name and only exact/current affiliate-linked stores.
    assert [s["id"] for s in data["stores"]] == ["s1", "s2"]


def test_category_detail_excludes_non_visible_inactive_and_archived_stores(server_module, monkeypatch):
    homepage_categories = [{"id": "c1", "name": "Beauty", "slug": "beauty", "active": True, "image_url": None, "display_rank": 1}]
    rate_cards = [_rule("ok", "Beauty"), _rule("hidden", "Beauty"), _rule("inactive", "Beauty"), _rule("archived", "Beauty")]
    stores = [
        {"id": "ok", "name": "Visible", "slug": "visible", "active": True, "homepage_visible": True, "archived_at": None, "display_rank": 1},
        {"id": "hidden", "name": "Hidden", "slug": "hidden", "active": True, "homepage_visible": False, "archived_at": None, "display_rank": 0},
        {"id": "inactive", "name": "Inactive", "slug": "inactive", "active": False, "homepage_visible": True, "archived_at": None, "display_rank": 0},
        {"id": "archived", "name": "Archived", "slug": "archived", "active": True, "homepage_visible": True, "archived_at": _iso(0), "display_rank": 0},
    ]
    monkeypatch.setattr(server_module, "db", _FakeDb(homepage_categories, rate_cards, stores))

    data = asyncio.run(server_module.public_homepage_category_detail("beauty"))
    assert [s["id"] for s in data["stores"]] == ["ok"]


def test_unknown_category_returns_404(server_module, monkeypatch):
    monkeypatch.setattr(server_module, "db", _FakeDb([], [], []))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(server_module.public_homepage_category_detail("nope"))
    assert exc.value.status_code == 404


def test_internal_all_category_returns_404(server_module, monkeypatch):
    homepage_categories = [{"id": "c_all", "name": "All", "slug": "all", "active": True, "image_url": None, "display_rank": 1}]
    monkeypatch.setattr(server_module, "db", _FakeDb(homepage_categories, [], []))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(server_module.public_homepage_category_detail("all"))
    assert exc.value.status_code == 404


def test_no_matching_stores_returns_empty_array(server_module, monkeypatch):
    homepage_categories = [{"id": "c1", "name": "Finance", "slug": "finance", "active": True, "image_url": None, "display_rank": 1}]
    # Rule exists but no eligible public store survives filters.
    rate_cards = [_rule("dead", "Finance")]
    stores = [{"id": "dead", "name": "Dead", "slug": "dead", "active": False, "homepage_visible": True, "archived_at": None, "display_rank": 1}]
    monkeypatch.setattr(server_module, "db", _FakeDb(homepage_categories, rate_cards, stores))

    data = asyncio.run(server_module.public_homepage_category_detail("finance"))
    assert data["category"]["slug"] == "finance"
    assert data["stores"] == []


def test_hidden_homepage_category_should_not_resolve_publicly(server_module, monkeypatch):
    """Current implementation bug check: hidden categories should not be publicly resolvable."""
    homepage_categories = [{"id": "c_hidden", "name": "Hidden", "slug": "hidden", "active": True, "homepage_visible": False, "image_url": None, "display_rank": 9}]
    monkeypatch.setattr(server_module, "db", _FakeDb(homepage_categories, [], []))

    with pytest.raises(HTTPException) as exc:
        asyncio.run(server_module.public_homepage_category_detail("hidden"))
    assert exc.value.status_code == 404
