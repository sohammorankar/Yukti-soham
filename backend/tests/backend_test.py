"""
YuktiCart backend regression tests.
Covers: /api/calculate, /api/detect, auth, admin CRUD + audit,
rate matrix import/publish/rollback, gratitude idempotency.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

API = f"{BASE_URL}/api"
OWNER_EMAIL = "owner@yukticart.com"
OWNER_PASS = "YuktiOwner@2026"


def fresh():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def client():
    return fresh()


@pytest.fixture(scope="session")
def owner_token():
    s = fresh()
    r = s.post(f"{API}/auth/login",
               json={"email": OWNER_EMAIL, "password": OWNER_PASS})
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    # verify cookie set
    assert any(c.name in ("access_token", "refresh_token") for c in s.cookies), \
        "expected auth cookies to be set"
    return data["access_token"]


@pytest.fixture
def owner_client(owner_token):
    s = fresh()
    s.headers["Authorization"] = f"Bearer {owner_token}"
    return s


# ---------- /api/calculate ----------
class TestCalculate:
    def test_firstcry_existing_double_stack(self, client):
        r = client.post(f"{API}/calculate", json={
            "store_name": "Firstcry", "category": "All",
            "customer_type": "existing", "mrp": 1599, "price": 1338
        })
        assert r.status_code == 200, r.text
        d = r.json()
        s = d["summary"]
        assert s["extra_saved"]["rupees"] == 88
        assert s["extra_saved"]["exact"] == "87.50"
        assert s["final_bill"]["rupees"] == 1251
        assert s["final_bill"]["exact"] == "1250.50"
        assert s["total_saving"]["rupees"] == 349
        st = d["stacking"]
        assert st["double_stack"] is True
        assert st["gift_card_spend"]["rupees"] == 750
        assert st["other_payment_spend"]["rupees"] == 588
        # Affiliate best CashKaro flat 35 MOV 500
        best = d["affiliate"]["best"]
        assert best["platform_name"] == "CashKaro"
        assert best["value_type"] == "flat_amount"
        assert float(best["value"]) == 35.0
        assert str(best["minimum_order_value"]).startswith("500")
        # gift card 7% applied_to 750
        gc = d.get("gift_card", {}).get("best") or d.get("gift_card") or {}
        # try multiple shapes
        applied_to = None
        if isinstance(gc, dict):
            applied_to = (gc.get("applied_to") or {})
            if isinstance(applied_to, dict):
                applied_to = applied_to.get("rupees")
        assert applied_to == 750, f"gift_card applied_to should be 750, got {d.get('gift_card')}"

    def test_tata_cliq_not_allowed_no_double_stack(self, client):
        r = client.post(f"{API}/calculate", json={
            "store_name": "Tata Cliq", "category": "All",
            "customer_type": "existing", "mrp": 2000, "price": 1800
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["stacking"]["double_stack"] is False


# ---------- /api/detect ----------
class TestDetect:
    def test_bean_bag_furniture(self, client):
        r = client.post(f"{API}/detect", json={
            "url": "https://example.com/bean-bag-xxl-filled"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        cat_obj = d.get("category") or {}
        cat = (cat_obj.get("category") if isinstance(cat_obj, dict) else cat_obj) or ""
        assert "Furniture" in cat or "Home" in cat, f"got {d}"

    def test_amazon_notice(self, client):
        r = client.post(f"{API}/detect", json={
            "url": "https://www.amazon.in/dp/B0ABC"
        })
        assert r.status_code == 200
        assert r.json().get("amazon_flipkart_notice") is True

    def test_flipkart_notice(self, client):
        r = client.post(f"{API}/detect", json={
            "url": "https://www.flipkart.com/xyz/p/itmABC"
        })
        assert r.status_code == 200
        assert r.json().get("amazon_flipkart_notice") is True


# ---------- auth ----------
class TestAuth:
    def test_login_and_me(self, owner_token):
        s = fresh()
        s.headers["Authorization"] = f"Bearer {owner_token}"
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200, r.text
        d = r.json()
        roles = d.get("roles") or (d.get("user") or {}).get("roles") or []
        assert "owner" in roles

    def test_admin_requires_auth(self, client):
        r = client.get(f"{API}/admin/audit")
        assert r.status_code in (401, 403)

    def test_admin_post_requires_auth(self, client):
        r = client.post(f"{API}/admin/platforms", json={"name": "X"})
        assert r.status_code in (401, 403)


# ---------- admin CRUD + audit ----------
class TestAdminCRUD:
    def test_platform_crud_and_audit(self, owner_client):
        name = f"TEST_PF_{uuid.uuid4().hex[:6]}"
        r = owner_client.post(f"{API}/admin/platforms",
                              json={"name": name, "kind": "affiliate"})
        assert r.status_code in (200, 201), r.text
        j = r.json()
        pid = j.get("id") or (j.get("platform") or {}).get("id")
        assert pid, r.text
        r = owner_client.put(f"{API}/admin/platforms/{pid}",
                             json={"name": name + "_upd"})
        assert r.status_code == 200, r.text
        r = owner_client.delete(f"{API}/admin/platforms/{pid}")
        assert r.status_code in (200, 204), r.text
        r = owner_client.post(f"{API}/admin/platforms/{pid}/restore")
        assert r.status_code in (200, 204, 404)
        r = owner_client.get(f"{API}/admin/audit")
        assert r.status_code == 200
        entries = r.json()
        items = entries if isinstance(entries, list) else entries.get("items", [])
        assert any("platform" in str(e).lower() for e in items)


# ---------- rate matrix bulk import ----------
class TestRateImport:
    def _get_ids(self, owner_client):
        stores = owner_client.get(f"{API}/admin/stores").json()
        plats = owner_client.get(f"{API}/admin/platforms").json()
        cats = owner_client.get(f"{API}/admin/categories").json()
        def _find(lst, name):
            for x in (lst if isinstance(lst, list) else lst.get("items", [])):
                if x.get("name", "").lower() == name.lower():
                    return x
            return None
        s = _find(stores, "Amazon")
        p = _find(plats, "CashKaro")
        assert s and p, "seed missing Amazon/CashKaro"
        return s["id"], p["id"], cats

    def test_preview_publish_rollback(self, owner_client):
        sid_, pid_, cats = self._get_ids(owner_client)
        raw = "category\texisting\nAll\t7%\n"
        r = owner_client.post(f"{API}/admin/rates/import/preview", json={
            "store_id": sid_, "platform_id": pid_,
            "customer_type": "existing", "raw": raw
        })
        assert r.status_code == 200, r.text
        prev = r.json()
        assert "rows" in prev and prev["rows"]
        # publish
        r = owner_client.post(f"{API}/admin/rates/import/publish", json={
            "store_id": sid_, "platform_id": pid_,
            "customer_type": "existing", "rows": prev["rows"]
        })
        # Might return 400 if all rows were "unchanged"; treat as skip
        if r.status_code == 400 and "No valid" in r.text:
            pytest.skip("no changed rows to publish (rates already match)")
        assert r.status_code in (200, 201), r.text
        batch = r.json().get("batch_id")
        assert batch
        # verify public calculate still works
        r2 = requests.post(f"{API}/calculate", json={
            "store_name": "Amazon", "category": "All",
            "customer_type": "existing", "mrp": 1000, "price": 900
        })
        assert r2.status_code == 200
        # rollback
        r = owner_client.post(f"{API}/admin/rates/import/rollback",
                              json={"batch_id": batch})
        assert r.status_code == 200, r.text
        assert r.json().get("rolled_back") is True


# ---------- gratitude idempotency ----------
class TestGratitude:
    def test_ring_and_undo_idempotent(self, client):
        key = f"test-{uuid.uuid4()}"
        r1 = client.post(f"{API}/gratitude/ring",
                         json={"idempotency_key": key})
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        count1 = d1.get("count")
        assert isinstance(count1, int)
        r2 = client.post(f"{API}/gratitude/ring",
                        json={"idempotency_key": key})
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("already") is True
        assert d2.get("count") == count1
        r3 = client.post(f"{API}/gratitude/undo",
                        json={"idempotency_key": key})
        assert r3.status_code == 200, r3.text
        d3 = r3.json()
        assert d3.get("count") == count1 - 1
        # never below zero
        for _ in range(3):
            client.post(f"{API}/gratitude/undo",
                        json={"idempotency_key": f"z-{uuid.uuid4()}"})
        cur = client.get(f"{API}/gratitude").json().get("count", 0)
        assert cur >= 0
