# YuktiCart Calculation Rules

All monetary math is performed with Python `Decimal` at paise precision. Totals are always
computed from exact decimal component values. Display values are rounded to the nearest whole
rupee using ROUND_HALF_UP (standard commercial rounding). APIs return both `exact` (full paise
string) and `rupees` (rounded int) so the client never re-rounds.

## Applying one rate
```
eligible = active
           AND today within [valid_from, valid_until]
           AND price >= minimum_order_value (when set)
           AND customer_type matches (rate.customer_type in {requested, "both"})

appliedTo   = min(price, maximum_eligible_amount ?? price)
percent     = appliedTo * value / 100
flat_amount = value
ineligible  => amount = 0
```

## Choosing the best rule per side
For each side (affiliate cashback, gift-card discount) evaluate every eligible rule whose category
matches the product category OR is "All" (case-insensitive). Pick the highest monetary saving.
Ties break by: priority (desc) → latest valid_from → deterministic id. An exact-category rule wins
over an "All" rule only when it yields the preferred (higher) valid saving.

## Stacking + split payment
```
giftCardSpend      = min(price, giftCardRule.cap ?? price)
otherPaymentSpend  = max(0, price - giftCardSpend)
partialGiftCard    = giftCardSaving > 0 AND otherPaymentSpend > 0
splitExceptionValid= partialGiftCard AND store.split_payment_supported != "no"

doubleStack = cashbackSaving > 0 AND giftCardSaving > 0
              AND (store.stacking != "not_allowed" OR splitExceptionValid)

extraSaved  = doubleStack ? cashbackSaving + giftCardSaving : max(cashbackSaving, giftCardSaving)
finalBill   = max(0, price - extraSaved)
retailSaving= max(0, MRP - price)
totalSaving = retailSaving + extraSaved
totalSavingPercent = MRP>0 ? totalSaving/MRP*100 : 0
```
When not double-stacking, only the applied route counts toward the total; the other route is
flagged `skipped` ("Not combinable — skipped").

Warnings are shown for: Amazon/Flipkart category/commission uncertainty; `stacking = unsure`;
`split_payment_supported = unsure`; and the not_allowed+split-exception case.

## Worked example — Firstcry (Existing)
- MRP ₹1,599, price ₹1,338.
- CashKaro cashback: ₹35 flat, MOV ₹500 → ₹1,338 ≥ ₹500 ⇒ ₹35.
- Gift card: 7% capped at ₹750 → 7% of ₹750 = ₹52.50 (display ₹53).
- Split: ₹750 gift card + ₹588 other payment; order value stays ₹1,338 so cashback stays eligible.
- Exact extra saved = ₹87.50 (display ₹88).
- Exact final bill = ₹1,250.50 (display ₹1,251).
- Exact total saving vs MRP = ₹348.50 (display ₹349).
Component values are never mixed after rounding; totals derive from exact decimals.
