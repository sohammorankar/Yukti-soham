"""Focused tests for shopper-input changes: rule-based field visibility flags,
optional MRP, and MRP>price validation. Non-destructive (read-only + calc only)."""
import os
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


def _stores():
    return requests.get(f"{API}/public/stores").json()


def _sid(name):
    return next(r["id"] for r in _stores() if r["name"] == name)


def test_public_stores_rule_flags():
    rows = _stores()
    by = {r["name"]: r for r in rows}
    assert all("has_category_rules" in r and "has_customer_type_rules" in r for r in rows)
    # Amazon has category-specific affiliate rules -> category applies
    assert by["Amazon"]["has_category_rules"] is True
    # Firstcry affiliate rules are all wildcard "All" -> category must NOT apply
    assert by["Firstcry"]["has_category_rules"] is False
    # Firstcry has new + existing affiliate payouts -> customer type applies
    assert by["Firstcry"]["has_customer_type_rules"] is True


def test_calculate_without_mrp():
    r = requests.post(f"{API}/calculate", json={
        "store_id": _sid("Firstcry"), "store_name": "Firstcry", "price": 9000})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["summary"]["mrp_provided"] is False
    assert d["inputs"]["mrp"] is None
    # no fabricated retail saving; total savings == stacked savings only
    assert d["summary"]["retail_saving"]["rupees"] == 0
    assert d["summary"]["total_saving"]["exact"] == d["summary"]["extra_saved"]["exact"]


def test_calculate_with_mrp():
    r = requests.post(f"{API}/calculate", json={
        "store_id": _sid("Firstcry"), "store_name": "Firstcry", "price": 9000, "mrp": 10000})
    assert r.status_code == 200
    d = r.json()
    assert d["summary"]["mrp_provided"] is True
    assert d["inputs"]["mrp"]["rupees"] == 10000
    assert d["summary"]["retail_saving"]["rupees"] == 1000


def test_calculate_price_above_mrp_rejected():
    r = requests.post(f"{API}/calculate", json={
        "store_id": _sid("Firstcry"), "store_name": "Firstcry", "price": 10000, "mrp": 9000})
    assert r.status_code == 422


def test_calculate_without_category_ok():
    # category omitted still calculates via wildcard "All" rules
    r = requests.post(f"{API}/calculate", json={
        "store_id": _sid("Amazon"), "store_name": "Amazon", "price": 5000})
    assert r.status_code == 200
