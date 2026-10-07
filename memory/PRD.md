# YuktiCart — Product Requirements Document

## Original problem statement
Production-ready web app "YuktiCart.com": a tactical shopping savings and checkout-stack engine for
Indian shoppers. Shopper pastes a product URL or picks store + category, enters MRP and selling
price, selects new/existing customer, and receives the mathematically best payment route stacking
affiliate cashback, discounted gift cards, store discounts, MOV, caps and store-specific stacking /
split-payment policies. Includes a secure Rate Console for daily rate management, three selectable
visual directions, an Aabhar Mandir gratitude experience, and full supporting pages.

## Architecture (as built)
- React 19 + Tailwind + shadcn/ui + Framer Motion + Lucide; react-router; axios.
- FastAPI + Motor(MongoDB); JWT (bcrypt) auth with `user_roles`; owner bootstrap via ADMIN_ALLOWLIST.
- Decimal-safe money engine (`backend/money.py`, `backend/engine.py`), seed in `backend/seed.py`.
- Collections: users, user_roles, platforms, stores, store_domains, categories, category_keywords,
  rate_cards, rate_imports, audit_log, category_corrections, feedback, gratitude(+actions),
  login_attempts.

## User personas
- **Shopper:** non-technical, wants the lowest final bill with clear, trustworthy guidance.
- **Rate admin/owner:** updates daily-changing rates without code; needs bulk paste + rollback.

## Core requirements (static)
Best affiliate route, best gift-card route, combinability incl. split-payment, exact lowest-bill
checkout sequence; admin-managed stores/platforms/categories/aliases/keywords/rates synced live;
secure server-side authz + audit; accessible responsive premium UI.

## Implemented (2026-06-21)
- Savings engine: URL detection (store + weighted category confidence, bean-bag→Furniture/Home),
  Amazon/Flipkart notice, Existing-default customer toggle + tooltip, decimal-safe calculation.
- Results: extra saved, final bill, total vs MRP, boost %, route comparison with applied/skipped,
  checkout steps, warnings, emotional mascot panel (4 states).
- Firstcry fixture verified: ₹88 / ₹1,251 / ₹349, ₹750+₹588 split, double-stack.
- Aabhar Mandir: Web Audio bell, diya, blessings, auto flower-rain, reversible undo, global atomic
  count with idempotency keys.
- First-load transition (Spot→Check→Stack→Save, CSS-driven, skippable, reduced-motion aware).
- Three visual directions via semantic tokens + selector; Black & Gold default.
- Full public pages + all footer legal/help pages; brands & categories from DB.
- Secure Rate Console: dashboard/checklist, Rate Editor, Rate Matrix bulk paste (preview/publish/
  rollback/CSV), Platforms, Stores & Domains, Categories & Keywords, Audit Log.
- Delivery docs: CALCULATION_RULES, SECURITY_MODEL, ADMIN_ONBOARDING, rate_matrix_template.csv,
  env examples, README.
- Testing: backend 11/11 pytest pass; frontend flows + all footer pages verified.

## Implemented (2026-10-07) — Smart Rate Import Phase 1
- Rate Matrix accepts generic natural-language partner sheets as well as legacy spreadsheet rows.
- Detects `new` / `existing` / `both`, expands top-level category lists and grouped expressions,
  preserves legitimate labels such as `All Footwear`, and maps only explicit fallback wording to
  the internal `All` wildcard.
- Final preview is record-level and shows category, rate, user type, CREATE/UPDATE/UNCHANGED/
  NEEDS REVIEW action, previous rate, status, warnings, and requested summary counts.
- Affiliate payout caps use additive `maximum_cashback_amount`; gift-card eligible-spend caps remain
  `maximum_eligible_amount`. MOV, validity, notes, history, publish supersession, and rollback remain
  compatible with existing rate cards.
- Focused verification: 15/15 Phase 1 parser/preview/cap/guardrail tests pass; frontend production
  build passes. No business data, collections, images, assets, or deployment were created.

## Backlog (prioritized)
- **P1 / Phase 2:** Shopper-facing category grouping and presentation for expanded partner categories.
- **P1:** MFA for admins; email verification flow; password reset UI; recent-login reauth for role
  changes. Full keyboard cell editing / multi-select / fill-down in the Rate Matrix grid.
- **P2:** Draft→publish workflow surfaced in Matrix; per-store rate versioning UI; category
  corrections analytics dashboard; OG image assets per route; split server.py into routers.
- **P2:** rate_editor/viewer role management UI (backend roles already enforced).

## Next tasks
See Next Action Items in the delivery summary.
