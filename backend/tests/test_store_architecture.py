"""Milestone 2 focused tests: store slug / ranking / media / curation + public lookup.

Non-destructive: creates throwaway stores (uuid-suffixed names) and archives them
afterwards. Does NOT rewrite the existing suite.
"""
import os
import uuid
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    env = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")
    try:
        with open(env) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except FileNotFoundError:
        pass
API = f"{BASE_URL}/api"
OWNER_EMAIL = "owner@yukticart.com"
OWNER_PASS = "YuktiOwner@2026"


def owner_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASS})
    assert r.status_code == 200, f"owner login failed {r.status_code} {r.text}"
    s.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return s


def _mk(s, name, **extra):
    body = {"name": name}
    body.update(extra)
    r = s.post(f"{API}/admin/stores", json=body)
    assert r.status_code == 200, f"create failed {r.status_code} {r.text}"
    return r.json()


def _archive(s, sid):
    s.delete(f"{API}/admin/stores/{sid}")


def test_public_stores_ranked_order():
    rows = requests.get(f"{API}/public/stores").json()
    ranks = [r.get("display_rank") for r in rows if r.get("display_rank") is not None]
    assert ranks == sorted(ranks), "public stores must be display_rank ascending"
    assert all("slug" in r for r in rows), "every public store exposes a slug"


def test_store_lookup_by_slug():
    rows = requests.get(f"{API}/public/stores").json()
    assert rows, "expected seeded stores"
    slug = rows[0]["slug"]
    r = requests.get(f"{API}/public/stores/{slug}")
    assert r.status_code == 200
    d = r.json()
    for f in ("id", "name", "slug", "store_url", "logo_url", "image_url",
              "description", "display_rank", "featured"):
        assert f in d, f"missing public field {f}"
    # private/admin fields must NOT be exposed on the public detail
    for f in ("stacking", "split_payment_supported", "homepage_visible", "archived_at"):
        assert f not in d, f"private field {f} leaked"
    assert requests.get(f"{API}/public/stores/does-not-exist-xyz").status_code == 404


def test_slug_uniqueness():
    s = owner_session()
    suffix = uuid.uuid4().hex[:6]
    a = _mk(s, f"Zeta Mart {suffix}")
    b = _mk(s, f"Zeta Mart {suffix}!!")  # different name, same slug base
    try:
        assert a["slug"] != b["slug"], "slugs must be unique"
        assert b["slug"].startswith(a["slug"]), "collision should suffix the base slug"
    finally:
        _archive(s, a["id"])
        _archive(s, b["id"])


def test_homepage_visible_filter_and_limit():
    s = owner_session()
    suffix = uuid.uuid4().hex[:6]
    hidden = _mk(s, f"Hidden Store {suffix}", homepage_visible=False)
    shown = _mk(s, f"Shown Store {suffix}", homepage_visible=True)
    try:
        home_ids = {r["id"] for r in requests.get(f"{API}/public/stores?homepage=true").json()}
        assert shown["id"] in home_ids
        assert hidden["id"] not in home_ids
        all_ids = {r["id"] for r in requests.get(f"{API}/public/stores").json()}
        assert hidden["id"] in all_ids, "hidden store still listed in the full list"
        limited = requests.get(f"{API}/public/stores?homepage=true&limit=3").json()
        assert len(limited) <= 3
    finally:
        _archive(s, hidden["id"])
        _archive(s, shown["id"])


def test_inactive_store_not_public():
    s = owner_session()
    suffix = uuid.uuid4().hex[:6]
    st = _mk(s, f"Temp Store {suffix}")
    slug = st["slug"]
    assert requests.get(f"{API}/public/stores/{slug}").status_code == 200
    _archive(s, st["id"])
    assert requests.get(f"{API}/public/stores/{slug}").status_code == 404
    assert st["id"] not in {r["id"] for r in requests.get(f"{API}/public/stores").json()}


def test_admin_only_modification_and_audit():
    s = owner_session()
    suffix = uuid.uuid4().hex[:6]
    st = _mk(s, f"Rank Store {suffix}")
    try:
        anon = requests.put(f"{API}/admin/stores/{st['id']}", json={"display_rank": 1})
        assert anon.status_code in (401, 403), "anonymous must not modify stores"
        r = s.put(f"{API}/admin/stores/{st['id']}",
                  json={"display_rank": 99, "logo_url": "https://x/logo.png", "featured": True})
        assert r.status_code == 200
        after = r.json()
        assert after["display_rank"] == 99
        assert after["logo_url"] == "https://x/logo.png"
        assert after["featured"] is True
        audit = s.get(f"{API}/admin/audit").json()
        assert any(a.get("entity_type") == "store" and a.get("entity_id") == st["id"]
                   for a in audit), "store update must be audited"
    finally:
        _archive(s, st["id"])
