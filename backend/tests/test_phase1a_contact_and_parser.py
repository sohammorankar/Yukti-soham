"""Phase-1A focused checks: contact feedback flow + explicit Both parsing behavior.

Read-only/isolated tests only:
- contact validation/delivery state transitions with MOCKED email provider
- parser/preview exact-match and Both/New/Existing expansion rules
"""

from __future__ import annotations

import asyncio
import importlib.util
import os
import sys

import pytest
from fastapi import HTTPException


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


class _FakeCursor:
    def __init__(self, rows):
        self._rows = list(rows)

    async def to_list(self, _limit):
        return list(self._rows)


def _match(row, query):
    for key, expected in (query or {}).items():
        if row.get(key) != expected:
            return False
    return True


class _FakeCollection:
    def __init__(self, rows=None):
        self.rows = list(rows or [])
        self.insert_calls = []
        self.update_calls = []

    async def insert_one(self, doc):
        self.insert_calls.append(dict(doc))
        self.rows.append(dict(doc))

    async def update_one(self, query, update):
        self.update_calls.append((dict(query), dict(update)))
        for row in self.rows:
            if _match(row, query):
                if "$set" in update:
                    row.update(update["$set"])
                return

    async def find_one(self, query, _projection=None):
        for row in self.rows:
            if _match(row, query):
                return dict(row)
        return None

    def find(self, query=None, _projection=None):
        rows = [dict(row) for row in self.rows if _match(row, query or {})]
        return _FakeCursor(rows)


class _FakeDb:
    def __init__(self):
        self.feedback = _FakeCollection()
        self.stores = _FakeCollection([{"id": "s1", "name": "Amazon"}])
        self.platforms = _FakeCollection([{"id": "p1", "name": "CashKaro", "kind": "affiliate"}])
        self.categories = _FakeCollection([
            {"id": "c_beauty", "name": "Beauty", "archived_at": None},
            {"id": "c_apparel", "name": "Apparel", "archived_at": None},
            {"id": "c_all", "name": "All", "archived_at": None},
            {"id": "c_all_footwear", "name": "All Footwear", "archived_at": None},
        ])
        self.rate_cards = _FakeCollection([])


def test_feedback_body_trims_and_requires_contact_email(server_module):
    with pytest.raises(Exception):
        server_module.FeedbackBody(kind="contact", message="  hi  ")

    body = server_module.FeedbackBody(
        kind="contact",
        name="  Alice  ",
        email="alice@example.com",
        message="  hello support  ",
    )
    assert body.name == "Alice"
    assert body.message == "hello support"
    assert str(body.email) == "alice@example.com"


def test_feedback_success_sets_sent_status(server_module, monkeypatch):
    fake_db = _FakeDb()
    monkeypatch.setattr(server_module, "db", fake_db)
    monkeypatch.setattr(server_module, "_contact_email_config", lambda: {
        "key": "k",
        "from_name": "YuktiCart",
        "recipient": "yukticart@gmail.com",
        "reply_to": None,
    })

    async def _ok_send(_doc, _cfg):
        return "email-123"

    monkeypatch.setattr(server_module, "_send_contact_notification", _ok_send)

    body = server_module.FeedbackBody(
        kind="contact",
        email="sender@example.com",
        message="Need help",
    )
    result = asyncio.run(server_module.feedback(body))
    assert result == {"ok": True, "delivery_status": "sent"}
    assert len(fake_db.feedback.insert_calls) == 1
    assert fake_db.feedback.rows[0]["delivery_status"] == "sent"
    assert fake_db.feedback.rows[0]["email_id"] == "email-123"


def test_feedback_missing_env_returns_503_before_insert(server_module, monkeypatch):
    fake_db = _FakeDb()
    monkeypatch.setattr(server_module, "db", fake_db)
    for key in ("EMERGENT_EMAIL_KEY", "EMAIL_FROM_NAME", "CONTACT_RECIPIENT_EMAIL", "EMAIL_REPLY_TO"):
        monkeypatch.delenv(key, raising=False)

    body = server_module.FeedbackBody(
        kind="contact",
        email="sender@example.com",
        message="Need help",
    )
    with pytest.raises(HTTPException) as exc:
        asyncio.run(server_module.feedback(body))
    assert exc.value.status_code == 503
    assert len(fake_db.feedback.insert_calls) == 0


def test_feedback_provider_failure_marks_failed(server_module, monkeypatch):
    fake_db = _FakeDb()
    monkeypatch.setattr(server_module, "db", fake_db)
    monkeypatch.setattr(server_module, "_contact_email_config", lambda: {
        "key": "k",
        "from_name": "YuktiCart",
        "recipient": "yukticart@gmail.com",
        "reply_to": None,
    })

    async def _fail_send(_doc, _cfg):
        raise HTTPException(status_code=502, detail="Unable to deliver your message right now")

    monkeypatch.setattr(server_module, "_send_contact_notification", _fail_send)

    body = server_module.FeedbackBody(
        kind="contact",
        email="sender@example.com",
        message="Need help",
    )
    with pytest.raises(HTTPException) as exc:
        asyncio.run(server_module.feedback(body))
    assert exc.value.status_code == 502
    assert len(fake_db.feedback.insert_calls) == 1
    assert fake_db.feedback.rows[0]["delivery_status"] == "failed"


def test_send_contact_uses_fixed_recipient_and_escapes_message(server_module, monkeypatch):
    sent = {}
    guard_called = {"value": False}

    class _Resp:
        def raise_for_status(self):
            return None

        def json(self):
            return {"id": "em-1"}

    def _fake_post(url, headers=None, json=None, timeout=None):
        sent["url"] = url
        sent["headers"] = headers
        sent["json"] = json
        sent["timeout"] = timeout
        return _Resp()

    def _guard(subject, html):
        guard_called["value"] = True
        assert "New YuktiCart contact message" in subject
        assert "<script>" not in html
        assert "&lt;script&gt;" in html

    monkeypatch.setattr(server_module.requests, "post", _fake_post)
    monkeypatch.setattr(server_module, "_assert_safe_email", _guard)

    doc = {
        "email": "sender@example.com",
        "name": "Sender",
        "message": "hello<script>alert(1)</script>",
    }
    cfg = {
        "key": "server-key",
        "from_name": "YuktiCart",
        "recipient": "yukticart@gmail.com",
        "reply_to": None,
    }
    out = asyncio.run(server_module._send_contact_notification(doc, cfg))
    assert out == "em-1"
    assert guard_called["value"] is True
    assert sent["headers"]["X-Email-Key"] == "server-key"
    assert sent["json"]["to"] == ["yukticart@gmail.com"]
    assert sent["json"]["to"] != [doc["email"]]


def test_frontend_feedback_has_no_email_key_exposure():
    src = open("/app/frontend/src/pages/FeedbackPage.jsx", "r", encoding="utf-8").read()
    assert "EMERGENT_EMAIL_KEY" not in src
    assert "X-Email-Key" not in src
    assert "delivery_status !== \"sent\"" in src
    assert "required={kind === \"contact\"}" in src
    assert "sending ? \"Sending…\" : \"Send message\"" in src


def test_parser_explicit_both_creates_single_both_row(server_module):
    raw = "Category | New | Existing | Both | Type | MOV | Cap\nBeauty |  |  | 6 | percent | 1000 | 200"
    rows = server_module.parse_paste(raw, "existing")
    assert len(rows) == 1
    assert rows[0]["customer_type"] == "both"
    assert rows[0]["value"] == "6"


def test_parser_equal_new_existing_creates_two_rows_not_both(server_module):
    raw = "Category | New | Existing | Type\nBeauty | 4 | 4 | percent"
    rows = server_module.parse_paste(raw, "existing")
    assert len(rows) == 2
    assert sorted([r["customer_type"] for r in rows]) == ["existing", "new"]


def test_parser_both_plus_typed_yields_parse_error(server_module):
    raw = "Category | New | Existing | Both | Type\nBeauty | 4 | 5 | 6 | percent"
    rows = server_module.parse_paste(raw, "existing")
    assert len(rows) == 1
    assert rows[0]["customer_type"] == "both"
    assert "parse_error" in rows[0]


def test_import_preview_ambiguous_both_plus_typed_is_needs_review(server_module, monkeypatch):
    fake_db = _FakeDb()
    monkeypatch.setattr(server_module, "db", fake_db)
    body = {
        "store_id": "s1",
        "platform_id": "p1",
        "customer_type": "existing",
        "raw": "Category | New | Existing | Both | Type\nBeauty | 4 | 5 | 6 | percent",
    }
    result = asyncio.run(server_module.import_preview(body, user={"id": "u1", "email": "qa@test"}))
    assert len(result["rows"]) == 1
    row = result["rows"][0]
    assert row["action"] == "NEEDS REVIEW"
    assert "Use either Both or New/Existing" in row["reason"]
    assert result["counts"]["errors"] == 1


def test_exact_matching_unmatched_stays_visible_with_source_and_reason(server_module, monkeypatch):
    fake_db = _FakeDb()
    monkeypatch.setattr(server_module, "db", fake_db)
    body = {
        "store_id": "s1",
        "platform_id": "p1",
        "customer_type": "existing",
        "raw": "Category | Existing | Type\nBeauty and Personal Care | 5 | percent",
    }
    result = asyncio.run(server_module.import_preview(body, user={"id": "u1", "email": "qa@test"}))
    row = result["rows"][0]
    assert row["action"] == "NEEDS REVIEW"
    assert row["source_text"].startswith("Beauty and Personal Care")
    assert "No exact category match" in row["reason"]


def test_expand_category_keeps_all_footwear_exact_and_wildcard_all(server_module):
    known = ["All", "All Footwear", "Beauty", "Apparel"]
    assert server_module._expand_category_expression("All Footwear", known) == ["All Footwear"]
    assert server_module._expand_category_expression("Everything Else", known) == ["All"]


def test_publish_source_excludes_needs_review_rows_by_action_check():
    source = open("/app/backend/server.py", "r", encoding="utf-8").read()
    assert 'r.get("action") in ("CREATE", "UPDATE")' in source
    assert '"rejected": [r for r in rows if r.get("action") == "NEEDS REVIEW"' in source
