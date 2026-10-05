"""YuktiCart calculation engine and URL/category detection.

Pure functions operating on plain dicts so they are trivially unit-testable.
All money math uses Decimal via money.py.
"""
import re
from datetime import datetime, timezone, date
from decimal import Decimal
from money import D, q, round_rupee, money_out, ZERO


# --------------------------------------------------------------------------
# Rate eligibility + application
# --------------------------------------------------------------------------

CARD_ELIGIBILITY_MODES = ("no_card_requirement", "any_card", "specific_card", "bank", "network")


def _norm_text(v):
    return re.sub(r"\s+", " ", str(v or "")).strip().lower()


def card_rule_eligible(rate, card):
    """Evaluate a rate's optional card-eligibility condition.

    rate fields: card_eligibility (mode), card_criteria (dict, mode-dependent).
    card: None or {bank_name, card_type, card_network} (shopper's saved profile).
    Returns (eligible: bool, reason: str|None).

    Backward compatible: rates without card_eligibility behave exactly as before.
    """
    mode = rate.get("card_eligibility") or "no_card_requirement"
    if mode == "no_card_requirement":
        return True, None
    if not card:
        return False, "Requires an eligible payment card"
    crit = rate.get("card_criteria") or {}
    if mode == "any_card":
        return True, None
    if mode == "bank":
        ok = _norm_text(card.get("bank_name")) == _norm_text(crit.get("bank_name"))
        return ok, None if ok else f"Requires a {crit.get('bank_name')} card"
    if mode == "network":
        ok = (card.get("card_network") or "") == (crit.get("card_network") or "")
        return ok, None if ok else f"Requires a {crit.get('card_network')} card"
    if mode == "specific_card":
        # Every configured attribute must match the selected card profile.
        checks = []
        if crit.get("bank_name"):
            checks.append(_norm_text(card.get("bank_name")) == _norm_text(crit.get("bank_name")))
        if crit.get("card_type"):
            checks.append((card.get("card_type") or "") == crit.get("card_type"))
        if crit.get("card_network"):
            checks.append((card.get("card_network") or "") == crit.get("card_network"))
        ok = bool(checks) and all(checks)
        label = crit.get("label") or crit.get("bank_name") or "the configured card"
        return ok, None if ok else f"Requires {label}"
    return False, "Unknown card eligibility rule"


def _parse_date(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
        except ValueError:
            return None


def rate_is_eligible(rate, price, customer_type, today=None, card=None):
    """Return (eligible: bool, reasons: list[str])."""
    reasons = []
    today = today or datetime.now(timezone.utc).date()

    if not rate.get("active", False):
        reasons.append("Rate is not active")

    vf = _parse_date(rate.get("valid_from"))
    vu = _parse_date(rate.get("valid_until"))
    if vf and today < vf:
        reasons.append("Not yet valid")
    if vu and today > vu:
        reasons.append("Expired")

    mov = rate.get("minimum_order_value")
    if mov not in (None, ""):
        if D(price) < D(mov):
            reasons.append(f"Order below minimum order value (₹{q(mov)})")

    rct = (rate.get("customer_type") or "both").lower()
    if rct not in ("both", (customer_type or "existing").lower()):
        reasons.append("Customer type does not match")

    # Optional card eligibility — only restricts rates that declare a card rule.
    card_ok, card_reason = card_rule_eligible(rate, card)
    if not card_ok:
        reasons.append(card_reason)

    return (len(reasons) == 0, reasons)


def apply_rate(rate, price):
    """Compute saving amount + applied base for an eligible rate (exact Decimal)."""
    price = D(price)
    cap = rate.get("maximum_eligible_amount")
    if cap not in (None, ""):
        applied_to = min(price, D(cap))
    else:
        applied_to = price

    if (rate.get("value_type") or "percent") == "percent":
        amount = applied_to * D(rate.get("value")) / Decimal("100")
    else:  # flat_amount
        amount = D(rate.get("value"))
    return q(amount), q(applied_to)


def category_matches(rate_category, product_category):
    rc = (rate_category or "").strip().lower()
    pc = (product_category or "").strip().lower()
    return rc == "all" or rc == pc


def _rate_sort_key(entry):
    # Highest saving, then priority, then latest valid_from, then id (deterministic).
    rate = entry["rate"]
    vf = _parse_date(rate.get("valid_from")) or date.min
    return (
        entry["saving"],
        D(rate.get("priority") or 0),
        vf.toordinal(),
        str(rate.get("id", "")),
    )


def best_rule_for_side(rules, price, product_category, customer_type, today=None, card=None):
    """From a list of rate dicts of one kind, return the best eligible entry.

    Returns dict with rate, saving (Decimal), applied_to (Decimal), eligible, reasons
    for the winner, plus the full evaluated list.
    """
    evaluated = []
    for rate in rules:
        if not category_matches(rate.get("category_name"), product_category):
            continue
        eligible, reasons = rate_is_eligible(rate, price, customer_type, today, card)
        saving, applied_to = (apply_rate(rate, price) if eligible else (ZERO, ZERO))
        evaluated.append({
            "rate": rate,
            "eligible": eligible,
            "reasons": reasons,
            "saving": saving,
            "applied_to": applied_to,
        })

    eligible_entries = [e for e in evaluated if e["eligible"] and e["saving"] > 0]
    winner = max(eligible_entries, key=_rate_sort_key) if eligible_entries else None
    return winner, evaluated


def calculate_stack(store, product_category, customer_type, mrp, price,
                    affiliate_rules, giftcard_rules, today=None, rate_version="v1",
                    card=None):
    """Full stacking calculation. Returns a JSON-serializable dict.

    card: optional shopper card profile {bank_name, card_type, card_network}.
    Only rates that declare a card_eligibility rule are affected by it; all
    other rates (and the no-card case) behave exactly as before.
    """
    price = D(price)
    mrp_provided = mrp is not None and str(mrp) != ""
    mrp = D(mrp) if mrp_provided else None
    customer_type = (customer_type or "existing").lower()

    aff_winner, aff_eval = best_rule_for_side(
        affiliate_rules, price, product_category, customer_type, today, card)
    gc_winner, gc_eval = best_rule_for_side(
        giftcard_rules, price, product_category, customer_type, today, card)

    cashback_saving = aff_winner["saving"] if aff_winner else ZERO
    giftcard_saving = gc_winner["saving"] if gc_winner else ZERO

    # Split-payment analysis for the gift card route
    gc_cap = None
    if gc_winner:
        cap = gc_winner["rate"].get("maximum_eligible_amount")
        gc_cap = D(cap) if cap not in (None, "") else price
    giftcard_spend = min(price, gc_cap) if gc_cap is not None else ZERO
    other_payment_spend = max(ZERO, price - giftcard_spend) if gc_winner else ZERO
    partial_gift_card = bool(gc_winner and giftcard_saving > 0 and other_payment_spend > 0)

    stacking = (store or {}).get("stacking", "unsure")
    split_supported = (store or {}).get("split_payment_supported", "unsure")

    # A valid split-payment exception requires split tender to be supported (not "no")
    split_exception_valid = partial_gift_card and split_supported != "no"

    double_stack = (
        cashback_saving > 0 and giftcard_saving > 0 and
        (stacking != "not_allowed" or split_exception_valid)
    )

    if double_stack:
        extra_saved = cashback_saving + giftcard_saving
    else:
        extra_saved = max(cashback_saving, giftcard_saving)

    final_bill = max(ZERO, price - extra_saved)
    retail_saving = (max(ZERO, mrp - price) if mrp_provided else ZERO)
    total_saving = retail_saving + extra_saved
    total_saving_percent = (total_saving / mrp * Decimal("100")) if (mrp_provided and mrp > 0) else ZERO
    boost_percent = (extra_saved / price * Decimal("100")) if price > 0 else ZERO

    # Determine which route was applied when not stacking
    applied_route = None
    if not double_stack and extra_saved > 0:
        applied_route = "affiliate" if cashback_saving >= giftcard_saving else "gift_card"

    # Verification warnings
    warnings = []
    store_name = (store or {}).get("name", "")
    if store_name.lower() in ("amazon", "flipkart"):
        warnings.append(
            "Amazon and Flipkart frequently change product classifications and "
            "affiliate commission rates. Verify the category and rate before purchase."
        )
    if double_stack and stacking == "unsure":
        warnings.append("Stacking is not confirmed for this store — please verify at checkout.")
    if partial_gift_card and split_supported == "unsure":
        warnings.append("Split payment is not confirmed for this store — please verify at checkout.")
    if stacking == "not_allowed" and split_exception_valid:
        warnings.append("This store does not allow stacking; only the valid split-payment exception is applied.")

    # Status
    if double_stack:
        status = "great_stack"
        status_label = "Great stack"
    elif extra_saved > 0:
        status = "one_route"
        status_label = "One strong route"
    else:
        status = "no_saving"
        status_label = "No eligible extra saving yet"
    if warnings and any("verify" in w.lower() for w in warnings) and extra_saved > 0:
        if stacking == "unsure" or split_supported == "unsure":
            status = "verify"
            status_label = "Please verify this combination"

    def route_payload(winner, evaluated, kind):
        options = []
        for e in evaluated:
            r = e["rate"]
            options.append({
                "rate_id": r.get("id"),
                "platform_name": r.get("platform_name"),
                "platform_kind": kind,
                "value_type": r.get("value_type"),
                "value": str(q(r.get("value"))),
                "saving": money_out(e["saving"]),
                "applied_to": money_out(e["applied_to"]),
                "minimum_order_value": (str(q(r["minimum_order_value"]))
                                        if r.get("minimum_order_value") not in (None, "") else None),
                "maximum_eligible_amount": (str(q(r["maximum_eligible_amount"]))
                                            if r.get("maximum_eligible_amount") not in (None, "") else None),
                "category_name": r.get("category_name"),
                "customer_type": r.get("customer_type"),
                "card_eligibility": r.get("card_eligibility") or "no_card_requirement",
                "card_rule_applied": bool(
                    winner and winner["rate"].get("id") == r.get("id")
                    and (r.get("card_eligibility") or "no_card_requirement") != "no_card_requirement"),
                "eligible": e["eligible"],
                "reasons": e["reasons"],
                "notes": r.get("notes"),
                "valid_until": r.get("valid_until"),
                "is_best": bool(winner and winner["rate"].get("id") == r.get("id")),
            })
        options.sort(key=lambda o: (not o["is_best"], -float(o["saving"]["exact"])))
        return {
            "kind": kind,
            "has_winner": winner is not None,
            "best": options[0] if (winner and options) else None,
            "options": options,
        }

    affiliate = route_payload(aff_winner, aff_eval, "affiliate")
    gift_card = route_payload(gc_winner, gc_eval, "gift_card")

    # Mark applied vs skipped for the single-route case
    affiliate["applied"] = bool(double_stack or applied_route == "affiliate")
    gift_card["applied"] = bool(double_stack or applied_route == "gift_card")
    affiliate["skipped"] = bool(affiliate["has_winner"] and not affiliate["applied"])
    gift_card["skipped"] = bool(gift_card["has_winner"] and not gift_card["applied"])

    checkout_steps = []
    if double_stack:
        checkout_steps = [
            f"Start your purchase through {affiliate['best']['platform_name']} so the full "
            f"order value of ₹{round_rupee(price)} is tracked for cashback.",
            f"Buy a gift card worth ₹{round_rupee(giftcard_spend)} from "
            f"{gift_card['best']['platform_name']} at its discounted rate.",
            (f"At checkout, pay ₹{round_rupee(giftcard_spend)} with the gift card and the "
             f"remaining ₹{round_rupee(other_payment_spend)} via UPI/card."
             if partial_gift_card else
             f"At checkout, pay ₹{round_rupee(giftcard_spend)} with the gift card."),
            "Expected affiliate cashback tracks a few days after a valid, non-excluded order. "
            "Always verify tracking, category and final commission before buying.",
        ]

    return {
        "rate_version": rate_version,
        "inputs": {
            "store": store_name,
            "category": product_category,
            "customer_type": customer_type,
            "card": ({
                "bank_name": card.get("bank_name"),
                "card_type": card.get("card_type"),
                "card_network": card.get("card_network"),
                "card_name": card.get("card_name"),
            } if card else None),
            "mrp": money_out(mrp) if mrp_provided else None,
            "price": money_out(price),
        },
        "summary": {
            "extra_saved": money_out(extra_saved),
            "final_bill": money_out(final_bill),
            "retail_saving": money_out(retail_saving),
            "total_saving": money_out(total_saving),
            "total_saving_percent": round(float(total_saving_percent), 1),
            "boost_percent": round(float(boost_percent), 1),
            "mrp_provided": mrp_provided,
            "status": status,
            "status_label": status_label,
        },
        "stacking": {
            "policy": stacking,
            "note": (store or {}).get("stacking_note"),
            "split_payment_supported": split_supported,
            "double_stack": double_stack,
            "partial_gift_card": partial_gift_card,
            "gift_card_spend": money_out(giftcard_spend) if gc_winner else None,
            "other_payment_spend": money_out(other_payment_spend) if gc_winner else None,
            "applied_route": applied_route,
        },
        "affiliate": affiliate,
        "gift_card": gift_card,
        "checkout_steps": checkout_steps,
        "warnings": warnings,
    }


# --------------------------------------------------------------------------
# URL parsing + weighted category detection
# --------------------------------------------------------------------------

def _extract_host_path(url):
    url = (url or "").strip()
    if not url:
        return "", ""
    if "://" not in url:
        url = "http://" + url
    m = re.match(r"https?://([^/]+)(/[^?#]*)?", url, re.IGNORECASE)
    if not m:
        return "", ""
    host = (m.group(1) or "").lower()
    path = (m.group(2) or "").lower()
    return host, path


def detect_store(url, store_domains):
    """store_domains: list of {domain_or_alias, store_id, store_name, priority}."""
    host, _ = _extract_host_path(url)
    if not host:
        return None
    host_clean = host.split(":")[0]
    matches = []
    for d in store_domains:
        alias = (d.get("domain_or_alias") or "").lower().strip()
        if not alias:
            continue
        if host_clean == alias or host_clean.endswith("." + alias) or alias in host_clean:
            matches.append((d.get("priority", 0), d))
    if not matches:
        return None
    matches.sort(key=lambda x: (-x[0], len(x[1].get("domain_or_alias", ""))))
    best = matches[0][1]
    return {"store_id": best.get("store_id"), "store_name": best.get("store_name")}


def _slug_text(host, path):
    text = (host + " " + path).replace("-", " ").replace("_", " ").replace("/", " ")
    text = re.sub(r"[^a-z0-9\s]", " ", text.lower())
    return " " + re.sub(r"\s+", " ", text).strip() + " "


def detect_category(url, keywords, store_id=None):
    """Weighted scoring category detection.

    keywords: list of dicts with category_id, category_name, store_id (nullable),
              phrase, match_type, weight, is_exclusion, active.
    Returns dict: {category, category_id, confidence (0-1), band, explanation, scores}
    """
    host, path = _extract_host_path(url)
    haystack = _slug_text(host, path)
    if not haystack.strip():
        return None

    scores = {}
    hits = {}
    excluded = set()

    for kw in keywords:
        if not kw.get("active", True):
            continue
        kw_store = kw.get("store_id")
        if kw_store and store_id and kw_store != store_id:
            continue
        phrase = (kw.get("phrase") or "").lower().strip()
        if not phrase:
            continue
        match_type = kw.get("match_type") or "contains"
        weight = float(kw.get("weight") or 1)
        cat = kw.get("category_name")

        matched = False
        if match_type == "exact_phrase":
            matched = (" " + phrase + " ") in haystack
            if matched:
                weight *= 2.0  # multi-word exact matches outrank broad single-word
                if " " in phrase:
                    weight *= 1.5
        elif match_type == "regex_safe_pattern":
            try:
                if re.search(re.escape(phrase).replace(r"\*", ".*"), haystack):
                    matched = True
            except re.error:
                matched = False
        else:  # contains
            matched = phrase in haystack
            if matched and kw.get("store_id"):
                weight *= 1.3  # store-specific taxonomy bonus

        if not matched:
            continue

        if kw.get("is_exclusion"):
            excluded.add(cat)
            scores[cat] = scores.get(cat, 0) - weight
        else:
            scores[cat] = scores.get(cat, 0) + weight
            hits.setdefault(cat, []).append((phrase, weight))

    # Remove excluded categories entirely if their net score is not positive
    ranked = sorted(
        [(c, s) for c, s in scores.items() if s > 0 and c not in excluded or (c not in excluded and s > 0)],
        key=lambda x: -x[1],
    )
    if not ranked:
        return None

    top_cat, top_score = ranked[0]
    second_score = ranked[1][1] if len(ranked) > 1 else 0
    # Confidence from absolute strength + margin over runner-up
    margin = (top_score - second_score) / top_score if top_score else 0
    confidence = min(1.0, (0.4 + 0.35 * min(top_score / 3.0, 1.0) + 0.25 * margin))
    band = "high" if confidence >= 0.75 else ("medium" if confidence >= 0.5 else "low")

    matched_phrases = [p for p, _ in hits.get(top_cat, [])]
    explanation = (
        f"Matched {', '.join(repr(p) for p in matched_phrases[:4])} for {top_cat}"
        if matched_phrases else f"Best match: {top_cat}"
    )
    cat_id = next((k.get("category_id") for k in keywords if k.get("category_name") == top_cat), None)
    return {
        "category": top_cat,
        "category_id": cat_id,
        "confidence": round(confidence, 2),
        "band": band,
        "explanation": explanation,
        "scores": {c: round(s, 2) for c, s in ranked[:5]},
    }
