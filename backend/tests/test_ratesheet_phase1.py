"""Phase-1 focused checks for generic rate-sheet parsing and preview decisions.

These tests are intentionally DB-write free:
- parser behavior (natural language + grouped categories)
- preview CREATE/UPDATE/UNCHANGED/NEEDS REVIEW decisions with fake read-only collections
- publish/rollback safeguards via source inspection only (no real publish call)
"""

import os
import re
import asyncio
import importlib
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
    server_mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(server_mod)
    return server_mod


@pytest.fixture
def engine_module():
    if "/app/backend" not in sys.path:
        sys.path.insert(0, "/app/backend")
    import engine as engine_mod
    return importlib.reload(engine_mod)


class _FakeCursor:
    def __init__(self, rows):
        self._rows = rows

    async def to_list(self, _limit):
        return list(self._rows)


def _match(row, query):
    for key, expected in (query or {}).items():
        if isinstance(expected, dict):
            return False
        if row.get(key) != expected:
            return False
    return True


class _FakeCollection:
    def __init__(self, rows):
        self._rows = list(rows)

    async def find_one(self, query, _projection=None):
        for row in self._rows:
            if _match(row, query):
                return dict(row)
        return None

    def find(self, query=None, _projection=None):
        rows = [dict(row) for row in self._rows if _match(row, query or {})]
        return _FakeCursor(rows)


class _FakeDb:
    def __init__(self):
        self.stores = _FakeCollection([
            {"id": "s1", "name": "Amazon"},
        ])
        self.platforms = _FakeCollection([
            {"id": "p1", "name": "CashKaro", "kind": "affiliate"},
        ])
        self.categories = _FakeCollection([
            {"id": "c_all_footwear", "name": "All Footwear", "archived_at": None},
            {"id": "c_elec", "name": "Electronics", "archived_at": None},
            {"id": "c_home", "name": "Home & Kitchen", "archived_at": None},
            {"id": "c_beauty", "name": "Beauty", "archived_at": None},
            {"id": "c_skin", "name": "Beauty - Skin Care", "archived_at": None},
            {"id": "c_hair", "name": "Beauty - Hair Care", "archived_at": None},
            {"id": "c_all", "name": "All", "archived_at": None},
        ])
        self.rate_cards = _FakeCollection([
            {
                "id": "r_existing_same",
                "store_id": "s1",
                "platform_id": "p1",
                "status": "published",
                "archived_at": None,
                "category_id": "c_elec",
                "category_name": "Electronics",
                "customer_type": "existing",
                "value_type": "percent",
                "value": "3",
                "minimum_order_value": "500",
                "maximum_cashback_amount": "100",
                "maximum_eligible_amount": None,
                "valid_from": None,
                "valid_until": None,
                "notes": "same",
            },
            {
                "id": "r_existing_diff",
                "store_id": "s1",
                "platform_id": "p1",
                "status": "published",
                "archived_at": None,
                "category_id": "c_home",
                "category_name": "Home & Kitchen",
                "customer_type": "existing",
                "value_type": "percent",
                "value": "2",
                "minimum_order_value": "500",
                "maximum_cashback_amount": "90",
                "maximum_eligible_amount": None,
                "valid_from": None,
                "valid_until": None,
                "notes": "old",
            },
        ])


def test_parse_rate_token_normalizes_4_80(server_module):
    value_type, value = server_module.parse_rate_token("4.80%")
    assert value_type == "percent"
    assert value == "4.8"


@pytest.mark.parametrize(
    "raw,expected_count",
    [
        ("6%\nCashback on Home & Kitchen (New Users)", 1),
        ("3% Cashback on Beauty and Personal Care (Existing Users)", 1),
        ("5%\nCashback on All Footwear (All Users)", 1),
        ("4%\nCashback on Everything Else (Existing Users)", 1),
        ("2%\nCashback on Beauty (Skin Care, Hair Care)", 1),
        ("7%\nCashback on Electronics, Home & Kitchen", 1),
        ("9%\nCashback on Apparel (New and Existing Users)", 1),
        ("1%\nCashback on Toys, up to ₹120", 1),
    ],
)
def test_parser_core_cases(server_module, raw, expected_count):
    rows = server_module.parse_paste(raw, "existing")
    assert len(rows) == expected_count


def test_category_expansion_preserves_all_footwear_and_maps_true_fallback(server_module):
    known = ["All Footwear", "Electronics", "All"]
    assert server_module._expand_category_expression("All Footwear", known) == ["All Footwear"]
    assert server_module._expand_category_expression("Everything Else", known) == ["All"]


def test_grouped_categories_expand(server_module):
    known = ["Beauty - Skin Care", "Beauty - Hair Care", "Beauty"]
    expanded = server_module._expand_category_expression("Beauty (Skin Care, Hair Care)", known)
    assert expanded == ["Beauty - Skin Care", "Beauty - Hair Care"]


def test_affiliate_cap_uses_maximum_cashback_amount(engine_module):
    saving, applied_to = engine_module.apply_rate(
        {
            "platform_kind": "affiliate",
            "value_type": "percent",
            "value": "10",
            "maximum_eligible_amount": "500",  # should be ignored for affiliate when payout cap is present
            "maximum_cashback_amount": "40",
        },
        "1000",
    )
    assert float(applied_to) == 1000.0
    assert float(saving) == 40.0


def test_giftcard_cap_keeps_maximum_eligible_amount_behavior(engine_module):
    saving, applied_to = engine_module.apply_rate(
        {
            "platform_kind": "gift_card",
            "value_type": "percent",
            "value": "10",
            "maximum_eligible_amount": "300",
            "maximum_cashback_amount": None,
        },
        "1000",
    )
    assert float(applied_to) == 300.0
    assert float(saving) == 30.0


def test_preview_decision_matrix_counts_with_fake_read_only_data(server_module, monkeypatch):
    fake_db = _FakeDb()
    monkeypatch.setattr(server_module, "db", fake_db)

    body = {
        "store_id": "s1",
        "platform_id": "p1",
        "customer_type": "existing",
        "raw": [
            {
                "category": "Electronics",
                "customer_type": "existing",
                "value_type": "percent",
                "value": "3",
                "mov": "500",
                "maximum_cashback_amount": "100",
                "notes": "same",
                "source_text": "row1",
            },
            {
                "category": "All Footwear",
                "customer_type": "new",
                "value_type": "percent",
                "value": "4.8",
                "mov": "500",
                "maximum_cashback_amount": "120",
                "notes": "new row",
                "source_text": "row2",
            },
            {
                "category": "Home & Kitchen",
                "customer_type": "existing",
                "value_type": "percent",
                "value": "3",
                "mov": "500",
                "maximum_cashback_amount": "90",
                "notes": "changed",
                "source_text": "row3",
            },
            {
                "category": "Everything Else",
                "customer_type": "existing",
                "value_type": "percent",
                "value": "2",
                "mov": "0",
                "maximum_cashback_amount": "70",
                "notes": "fallback",
                "source_text": "row4",
            },
            {
                "category": "Unknown Category",
                "customer_type": "existing",
                "value_type": "percent",
                "value": "1",
                "source_text": "row5",
            },
        ],
    }

    result = asyncio.run(server_module.import_preview(body, user={"id": "u1", "email": "qa@test"}))
    actions = [row["action"] for row in result["rows"]]
    assert actions == ["UNCHANGED", "CREATE", "UPDATE", "CREATE", "NEEDS REVIEW"]
    assert result["counts"] == {
        "parsed_records": 5,
        "new": 1,
        "existing": 4,
        "both": 0,
        "create": 2,
        "update": 1,
        "unchanged": 1,
        "errors": 1,
    }


def test_publish_guardrails_and_history_rollback_present_in_source():
    source = open("/app/backend/server.py", "r", encoding="utf-8").read()

    assert 'r.get("action") in ("CREATE", "UPDATE")' in source
    assert 'row_customer_type = (row.get("customer_type") or default_customer_type).lower()' in source
    assert 'raise HTTPException(400, "Duplicate category and customer type in preview rows")' in source

    # history + rollback structure retained
    assert '"inserted_ids": inserted_ids' in source
    assert '"superseded_ids": superseded_ids' in source
    assert '@api.post("/admin/rates/import/rollback")' in source
    assert '"status": "rolled_back"' in source
    assert '"$unset": {"superseded_by_batch": ""}' in source

    # MOV/conditions fields remain part of compare/persist logic
    assert '"minimum_order_value"' in source
    assert '"valid_from"' in source and '"valid_until"' in source
    assert re.search(r'compare_fields\s*=\s*\([^\)]*"notes"', source)
