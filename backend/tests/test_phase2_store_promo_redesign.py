"""
Phase-2 focused checks for Save by Store premium promo fields and card structure.
Covers backend promo normalization + API projection/query contracts and frontend wiring.
"""

import ast
import re
from pathlib import Path

import pytest
from fastapi import HTTPException


SERVER_PATH = Path("/app/backend/server.py")
HOME_PATH = Path("/app/frontend/src/pages/Home.jsx")
ADMIN_STORES_PATH = Path("/app/frontend/src/pages/admin/Stores.jsx")


def _load_store_promo_text_fn():
    tree = ast.parse(SERVER_PATH.read_text())
    fn_node = None
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == "_store_promo_text":
            fn_node = node
            break
    assert fn_node is not None, "_store_promo_text function must exist"

    module = ast.Module(body=[fn_node], type_ignores=[])
    code = compile(module, filename=str(SERVER_PATH), mode="exec")
    scope = {"re": re, "HTTPException": HTTPException}
    exec(code, scope)
    return scope["_store_promo_text"]


# ---- Backend promo normalization and max lengths ----
def test_store_promo_text_empty_normalizes_to_none():
    fn = _load_store_promo_text_fn()
    assert fn("", "promo_top_text", 80) is None
    assert fn(None, "promo_bottom_text", 120) is None


def test_store_promo_text_collapses_whitespace_and_trims():
    fn = _load_store_promo_text_fn()
    out = fn("  Mega   Sale   Today  ", "promo_top_text", 80)
    assert out == "Mega Sale Today"


def test_store_promo_text_rejects_non_text_payload():
    fn = _load_store_promo_text_fn()
    with pytest.raises(HTTPException) as exc:
        fn(123, "promo_top_text", 80)
    assert exc.value.status_code == 400
    assert "must be text" in str(exc.value.detail)


def test_store_promo_text_enforces_top_max_80():
    fn = _load_store_promo_text_fn()
    assert fn("x" * 80, "promo_top_text", 80) == "x" * 80
    with pytest.raises(HTTPException) as exc:
        fn("x" * 81, "promo_top_text", 80)
    assert exc.value.status_code == 400


def test_store_promo_text_enforces_bottom_max_120():
    fn = _load_store_promo_text_fn()
    assert fn("x" * 120, "promo_bottom_text", 120) == "x" * 120
    with pytest.raises(HTTPException) as exc:
        fn("x" * 121, "promo_bottom_text", 120)
    assert exc.value.status_code == 400


# ---- Backend API projection/query contract checks ----
def test_public_store_detail_projection_includes_promo_fields():
    text = SERVER_PATH.read_text()
    assert '"promo_top_text": 1' in text
    assert '"promo_bottom_text": 1' in text


def test_public_list_query_preserves_homepage_visibility_filter_and_sort_order():
    text = SERVER_PATH.read_text()
    assert 'if homepage:' in text
    assert 'filt["homepage_visible"] = True' in text
    assert '.sort(\n        [("display_rank", 1), ("name", 1)])' in text


def test_store_create_update_include_only_additive_promo_fields():
    text = SERVER_PATH.read_text()
    assert '"promo_top_text": _store_promo_text(body.get("promo_top_text"), "promo_top_text", 80)' in text
    assert '"promo_bottom_text": _store_promo_text(body.get("promo_bottom_text"), "promo_bottom_text", 120)' in text
    assert '"promo_top_text", "promo_bottom_text") if k in body' in text


# ---- Frontend admin form contract checks ----
def test_admin_stores_form_has_controlled_promo_fields_with_maxlength():
    text = ADMIN_STORES_PATH.read_text()
    assert 'value={form.promo_top_text}' in text
    assert 'value={form.promo_bottom_text}' in text
    assert 'maxLength={80}' in text
    assert 'maxLength={120}' in text
    assert 'data-testid="store-promo-top-text"' in text
    assert 'data-testid="store-promo-bottom-text"' in text


# ---- Homepage card structure and fallback wiring ----
def test_home_card_uses_promo_fields_and_asset_fallback_chain():
    text = HOME_PATH.read_text()
    assert 'const image = store.logo_url || store.image_url || getBrandAsset(store.name);' in text
    assert 'store.promo_top_text && (' in text
    assert 'store.promo_bottom_text && (' in text


def test_home_card_preserves_slug_route_and_fallback_destination():
    text = HOME_PATH.read_text()
    assert '? `/stores/${encodeURIComponent(store.slug)}`' in text
    assert ': `/brands?store=${encodeURIComponent(store.name)}`;' in text


def test_home_card_layout_order_and_responsive_height_contracts():
    text = HOME_PATH.read_text()
    assert 'data-testid={`brand-${slug}-promo-top`}' in text
    assert 'data-testid={`brand-${slug}-logo`}' in text
    assert 'data-testid={`brand-${slug}-divider`}' in text
    assert 'data-testid={`brand-${slug}-promo-bottom`}' in text
    assert 'min-h-[17rem]' in text
    assert 'h-24 w-full max-w-[11rem]' in text
    assert 'xl:grid-cols-5' in text
