"""YuktiCart calculation engine and URL/category detection.

Pure functions operating on plain dicts so they are trivially unit-testable.
All money math uses Decimal via money.py.
"""
import re
import math
import heapq
from urllib.parse import unquote, urlsplit
from datetime import datetime, timezone, date
from decimal import Decimal, ROUND_FLOOR
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
    kind = rate.get("platform_kind")
    cap = rate.get("maximum_eligible_amount")
    if kind == "affiliate" and rate.get("maximum_cashback_amount") not in (None, ""):
        cap = None
    if cap not in (None, ""):
        applied_to = min(price, D(cap))
    else:
        applied_to = price

    if (rate.get("value_type") or "percent") == "percent":
        amount = applied_to * D(rate.get("value")) / Decimal("100")
    else:  # flat_amount
        amount = D(rate.get("value"))
    payout_cap = rate.get("maximum_cashback_amount")
    if payout_cap in (None, ""):
        payout_cap = rate.get("cashback_cap_amount")
    if payout_cap not in (None, ""):
        amount = min(amount, D(payout_cap))
    return q(amount), q(applied_to)


def category_matches(rate_category, product_category):
    rc = (rate_category or "").strip().lower()
    pc = (product_category or "").strip().lower()
    return rc == "all" or rc == pc


def product_matches(phrase, product_url):
    """Only a pasted product URL can verify an admin-configured product phrase."""
    if not phrase or not product_url:
        return False
    try:
        parsed = urlsplit(product_url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            return False
        text = unquote(parsed.path + " " + parsed.query)
        normalized_url = " " + re.sub(r"[^a-z0-9]+", " ", text.lower()).strip() + " "
        normalized_phrase = " " + re.sub(r"[^a-z0-9]+", " ", phrase.lower()).strip() + " "
        return len(normalized_phrase.strip()) >= 3 and normalized_phrase in normalized_url
    except ValueError:
        return False


def best_gift_card_spend(price, denominations):
    """Largest purchasable sum <= price from verified denominations (repeatable cards)."""
    target_cents = int((D(price) * 100).to_integral_value(rounding=ROUND_FLOOR))
    coins = sorted({int((D(amount) * 100).to_integral_value()) for amount in denominations
                    if D(amount) > 0 and D(amount) <= D(price)})
    if not coins or target_cents <= 0:
        return ZERO
    scale = math.gcd(*coins)
    coins = [coin // scale for coin in coins]
    target = target_cents // scale
    minimum = coins[0]
    if minimum <= 50000:
        # Dijkstra by residue: once the smallest amount for a remainder is
        # reachable, any larger amount in that residue can add the minimum coin.
        distance = [None] * minimum
        distance[0] = 0
        queue = [(0, 0)]
        while queue:
            value, residue = heapq.heappop(queue)
            if value != distance[residue]:
                continue
            for coin in coins:
                new_value = value + coin
                remainder = new_value % minimum
                if new_value <= target and (distance[remainder] is None or new_value < distance[remainder]):
                    distance[remainder] = new_value
                    heapq.heappush(queue, (new_value, remainder))
        best = max((target - (target - value) % minimum
                    for value in distance if value is not None and value <= target), default=0)
    else:
        # Very large, unusual denominations: enumerate attainable amounts
        # rather than allocating an enormous residue table.
        reachable = {0}
        queue = [0]
        for value in queue:
            for coin in coins:
                candidate = value + coin
                if candidate <= target and candidate not in reachable:
                    reachable.add(candidate)
                    queue.append(candidate)
            if target in reachable:
                break
        best = max(reachable)
    return Decimal(best * scale) / Decimal("100")


def _rate_sort_key(entry):
    # Verified product rule > master category > internal All. Within a scope,
    # customer-specific rates win over both, then maximize actual rupees saved.
    rate = entry["rate"]
    scope = 2 if rate.get("product_match") else (1 if (rate.get("category_name") or "").lower() != "all" else 0)
    vf = _parse_date(rate.get("valid_from")) or date.min
    return (scope, int(rate.get("customer_type") not in (None, "both")),
            entry["saving"], D(rate.get("priority") or 0), vf.toordinal(), str(rate.get("id", "")))


def best_rule_for_side(rules, price, product_category, customer_type, today=None,
                       card=None, product_url=None, gift_card_denominations=None):
    """Choose by eligible rule specificity before comparing monetary savings."""
    evaluated = []
    for rate in rules:
        if not category_matches(rate.get("category_name"), product_category):
            continue
        if rate.get("product_match") and not product_matches(rate["product_match"], product_url):
            continue
        eligible, reasons = rate_is_eligible(rate, price, customer_type, today, card)
        amount = price
        if eligible and gift_card_denominations is not None:
            cap = rate.get("maximum_eligible_amount")
            spend_limit = min(D(price), D(cap)) if cap not in (None, "") else D(price)
            amount = best_gift_card_spend(spend_limit, gift_card_denominations)
            if amount <= 0:
                eligible = False
                reasons.append("No available gift-card denomination fits this purchase")
        saving, applied_to = (apply_rate(rate, amount) if eligible else (ZERO, ZERO))
        evaluated.append({
            "rate": rate,
            "eligible": eligible,
            "reasons": reasons,
            "saving": saving,
            "applied_to": applied_to,
        })

    # An eligible zero-rate exclusion must still win over a less-specific
    # generic cashback rule; it blocks a misleading fallback recommendation.
    eligible_entries = [entry for entry in evaluated if entry["eligible"]]
    winner = max(eligible_entries, key=_rate_sort_key) if eligible_entries else None
    if winner and winner["saving"] == 0:
        for entry in evaluated:
            if entry is not winner and entry["eligible"] and _rate_sort_key(entry)[:2] < _rate_sort_key(winner)[:2]:
                entry["eligible"] = False
                entry["saving"] = ZERO
                entry["applied_to"] = ZERO
                entry["reasons"].append("Superseded by a more specific zero-rate exclusion")
    return winner, evaluated



# --------------------------------------------------------------------------
# Independent card-offer eligibility + application
# --------------------------------------------------------------------------

def card_offer_is_eligible(offer, store, product_category, customer_type, price,
                           card, today=None):
    """Validate one merchant/card offer without changing existing rate rules."""
    reasons = []
    today = today or datetime.now(timezone.utc).date()
    if isinstance(today, datetime):
        today = today.date()

    if not offer.get("active", False):
        reasons.append("Offer is not active")
    if offer.get("store_id") != (store or {}).get("id"):
        reasons.append("Store does not match")
    if offer.get("card_id") != (card or {}).get("card_catalog_id"):
        reasons.append("Card does not match")

    valid_from = _parse_date(offer.get("valid_from"))
    valid_until = _parse_date(offer.get("valid_until"))
    if valid_from and today < valid_from:
        reasons.append("Offer is not yet valid")
    if valid_until and today > valid_until:
        reasons.append("Offer has expired")

    minimum = offer.get("minimum_order_value")
    if minimum not in (None, "") and D(price) < D(minimum):
        reasons.append(f"Order below minimum order value (₹{q(minimum)})")

    if offer.get("category_id") and not offer.get("category_name"):
        reasons.append("Offer category reference is unavailable")
    else:
        offer_category = offer.get("category_name") or "All"
        if not category_matches(offer_category, product_category):
            reasons.append("Category does not match")

    offer_customer = (offer.get("customer_type") or "both").lower()
    if offer_customer not in ("both", (customer_type or "existing").lower()):
        reasons.append("Customer type does not match")

    payment_method = (offer.get("payment_method") or "both").lower()
    card_type = (card or {}).get("card_type", "").lower()
    if payment_method != "both" and payment_method != card_type:
        reasons.append("Card payment method does not match")

    return len(reasons) == 0, reasons


def apply_card_offer(offer, price):
    """Calculate one card benefit with eligible-spend and payout caps kept distinct."""
    price = D(price)
    eligible_cap = offer.get("maximum_eligible_amount")
    applied_to = min(price, D(eligible_cap)) if eligible_cap not in (None, "") else price
    if offer.get("discount_type") == "percentage":
        amount = applied_to * D(offer.get("discount_value")) / Decimal("100")
    else:
        amount = D(offer.get("discount_value"))
    discount_cap = offer.get("maximum_discount_amount")
    if discount_cap not in (None, ""):
        amount = min(amount, D(discount_cap))
    return q(min(price, max(ZERO, amount))), q(applied_to)


def best_card_stack(card_offers, store, product_category, customer_type, price,
                    card, affiliate_saving, gift_card_saving,
                    affiliate_gift_card_stackable, today=None):
    """Evaluate each offer independently and return the strongest allowed combination."""
    evaluated = []
    candidates = []
    for offer in card_offers or []:
        eligible, reasons = card_offer_is_eligible(
            offer, store, product_category, customer_type, price, card, today)
        saving, applied_to = apply_card_offer(offer, price) if eligible else (ZERO, ZERO)
        entry = {
            "offer": offer,
            "eligible": eligible,
            "reasons": reasons,
            "saving": saving,
            "applied_to": applied_to,
        }
        evaluated.append(entry)
        if not eligible or saving <= 0:
            continue

        stackability = offer.get("stackability") or {}
        combinations = [(saving, False, False)]
        if stackability.get("affiliate") and affiliate_saving > 0:
            combinations.append((saving + affiliate_saving, True, False))
        if stackability.get("gift_card") and gift_card_saving > 0:
            combinations.append((saving + gift_card_saving, False, True))
        if (stackability.get("affiliate") and stackability.get("gift_card")
                and affiliate_gift_card_stackable):
            combinations.append((saving + affiliate_saving + gift_card_saving, True, True))

        total, use_affiliate, use_gift_card = max(combinations, key=lambda item: item[0])
        category_specific = int((offer.get("category_name") or "All").lower() != "all")
        customer_specific = int((offer.get("customer_type") or "both").lower() != "both")
        rank = (
            min(D(price), total),
            category_specific,
            customer_specific,
            int(offer.get("priority") or 0),
            (_parse_date(offer.get("valid_from")) or date.min).toordinal(),
            str(offer.get("id") or ""),
        )
        candidates.append({
            "entry": entry,
            "total": min(D(price), total),
            "use_affiliate": use_affiliate,
            "use_gift_card": use_gift_card,
            "rank": rank,
        })

    winner = max(candidates, key=lambda item: item["rank"]) if candidates else None
    return winner, evaluated


def calculate_stack(store, product_category, customer_type, mrp, price,
                    affiliate_rules, giftcard_rules, today=None, rate_version="v1",
                    card=None, product_url=None, gift_card_denominations=None,
                    card_offers=None):
    """Full stacking calculation. Returns a JSON-serializable dict.

    card: optional shopper card profile {bank_name, card_type, card_network,
    card_catalog_id}. Existing rate-card eligibility remains unchanged. Independent
    card_offers are evaluated only when a catalogue-backed saved card is supplied.
    """
    price = D(price)
    mrp_provided = mrp is not None and str(mrp) != ""
    mrp = D(mrp) if mrp_provided else None
    customer_type = (customer_type or "existing").lower()

    aff_winner, aff_eval = best_rule_for_side(
        affiliate_rules, price, product_category, customer_type, today, card,
        product_url=product_url)
    gc_winner, gc_eval = best_rule_for_side(
        giftcard_rules, price, product_category, customer_type, today, card,
        product_url=product_url, gift_card_denominations=gift_card_denominations)

    cashback_saving = aff_winner["saving"] if aff_winner else ZERO
    giftcard_saving = gc_winner["saving"] if gc_winner else ZERO

    # When denominations are configured, applied_to is an attainable total of
    # real gift cards, not an arbitrary amount up to the purchase price.
    giftcard_spend = gc_winner["applied_to"] if gc_winner else ZERO
    other_payment_spend = max(ZERO, price - giftcard_spend) if gc_winner else ZERO
    partial_gift_card = bool(gc_winner and giftcard_saving > 0 and other_payment_spend > 0)

    stacking = (store or {}).get("stacking", "unsure")
    split_supported = (store or {}).get("split_payment_supported", "unsure")

    # A valid split-payment exception requires split tender to be supported (not "no")
    split_exception_valid = partial_gift_card and split_supported != "no"

    affiliate_gift_card_stackable = (
        cashback_saving > 0 and giftcard_saving > 0 and
        (stacking != "not_allowed" or split_exception_valid)
    )

    if affiliate_gift_card_stackable:
        extra_saved = cashback_saving + giftcard_saving
    else:
        extra_saved = max(cashback_saving, giftcard_saving)

    # Preserve the existing winner as the baseline, then replace it only when an
    # eligible configured card offer produces a strictly better valid stack.
    applied_route = None
    if not affiliate_gift_card_stackable and extra_saved > 0:
        applied_route = "affiliate" if cashback_saving >= giftcard_saving else "gift_card"
    affiliate_applied = bool(affiliate_gift_card_stackable or applied_route == "affiliate")
    gift_card_applied = bool(affiliate_gift_card_stackable or applied_route == "gift_card")

    card_choice, card_evaluated = best_card_stack(
        card_offers, store, product_category, customer_type, price, card,
        cashback_saving, giftcard_saving, affiliate_gift_card_stackable, today)
    card_offer_applied = bool(card_choice and card_choice["total"] > extra_saved)
    if card_offer_applied:
        extra_saved = card_choice["total"]
        affiliate_applied = card_choice["use_affiliate"]
        gift_card_applied = card_choice["use_gift_card"]
        if affiliate_applied and gift_card_applied:
            applied_route = "card_affiliate_gift_card"
        elif affiliate_applied:
            applied_route = "card_affiliate"
        elif gift_card_applied:
            applied_route = "card_gift_card"
        else:
            applied_route = "card_offer"

    # double_stack retains its established meaning: affiliate + gift card are
    # both part of the selected result, whether or not a card offer also applies.
    double_stack = bool(affiliate_applied and gift_card_applied)

    final_bill = max(ZERO, price - extra_saved)
    retail_saving = (max(ZERO, mrp - price) if mrp_provided else ZERO)
    total_saving = retail_saving + extra_saved
    total_saving_percent = (total_saving / mrp * Decimal("100")) if (mrp_provided and mrp > 0) else ZERO
    boost_percent = (extra_saved / price * Decimal("100")) if price > 0 else ZERO

    # Verification warnings
    warnings = []
    if giftcard_rules and gift_card_denominations is not None:
        if not gift_card_denominations:
            warnings.append("Gift-card savings are unavailable until verified denominations are configured for this store.")
        elif not gc_winner:
            warnings.append("No available gift-card denomination fits this purchase.")
    if aff_winner and aff_winner["saving"] == 0:
        warnings.append("A more specific zero-rate rule excludes affiliate cashback for this product or category.")
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
    applied_component_count = int(affiliate_applied) + int(gift_card_applied) + int(card_offer_applied)
    if applied_component_count >= 2:
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
                "maximum_cashback_amount": (str(q(r["maximum_cashback_amount"]))
                                            if r.get("maximum_cashback_amount") not in (None, "") else None),
                "cashback_cap_amount": (str(q(r["cashback_cap_amount"]))
                                        if r.get("cashback_cap_amount") not in (None, "") else None),
                "product_match": r.get("product_match") or None,
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
            "has_winner": bool(winner and winner["saving"] > 0),
            "best": options[0] if (winner and winner["saving"] > 0 and options) else None,
            "options": options,
        }

    def card_offer_option(entry):
        offer = entry["offer"]
        return {
            "offer_id": offer.get("id"),
            "offer_name": offer.get("offer_name"),
            "offer_type": offer.get("offer_type"),
            "discount_type": offer.get("discount_type"),
            "discount_value": str(q(offer.get("discount_value"))),
            "saving": money_out(entry["saving"]),
            "applied_to": money_out(entry["applied_to"]),
            "minimum_order_value": offer.get("minimum_order_value"),
            "maximum_discount_amount": offer.get("maximum_discount_amount"),
            "maximum_eligible_amount": offer.get("maximum_eligible_amount"),
            "payment_method": offer.get("payment_method"),
            "customer_type": offer.get("customer_type"),
            "category_name": offer.get("category_name") or "All",
            "stackability": offer.get("stackability") or {},
            "priority": offer.get("priority", 0),
            "valid_from": offer.get("valid_from"),
            "valid_until": offer.get("valid_until"),
            "eligibility_notes": offer.get("eligibility_notes"),
            "notes": offer.get("notes"),
            "eligible": entry["eligible"],
            "reasons": entry["reasons"],
            "is_applied": bool(card_offer_applied and card_choice and card_choice["entry"] is entry),
        }

    card_offer_options = [card_offer_option(entry) for entry in card_evaluated]
    card_offer_best = (card_offer_option(card_choice["entry"]) if card_choice else None)
    card_offer = {
        "has_winner": bool(card_choice),
        "applied": card_offer_applied,
        "best": card_offer_best,
        "applied_offer": card_offer_best if card_offer_applied else None,
        "card_name": (card or {}).get("card_name"),
        "options": card_offer_options,
    }

    affiliate = route_payload(aff_winner, aff_eval, "affiliate")
    gift_card = route_payload(gc_winner, gc_eval, "gift_card")
    gift_card["denomination_status"] = ("unavailable" if giftcard_rules and gift_card_denominations == []
                                        else "available" if gift_card_denominations else "not_applicable")
    gift_card["available_denominations"] = ([money_out(amount) for amount in gift_card_denominations]
                                              if gift_card_denominations is not None else None)

    # Mark only the components selected by the winning comparison.
    affiliate["applied"] = affiliate_applied
    gift_card["applied"] = gift_card_applied
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
                "card_catalog_id": card.get("card_catalog_id"),
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
            **({
                "card_offer_applied": card_offer_applied,
                "applied_components": [name for name, applied in (
                    ("affiliate", affiliate_applied),
                    ("gift_card", gift_card_applied),
                    ("card_offer", card_offer_applied),
                ) if applied],
            } if card else {}),
        },
        "affiliate": affiliate,
        "gift_card": gift_card,
        **({"card_offer": card_offer} if card else {}),
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
