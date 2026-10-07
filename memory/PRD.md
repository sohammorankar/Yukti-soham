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

## Implemented (2026-10-07) — Shopper Category Grouping Phase 2
- Public store responses now derive presentation-only category groups from currently active,
  published affiliate rules. Group signatures cover both new and existing shopper contexts,
  including compatible `both` rules, partner, value, MOV, caps, validity, priority, product and card
  conditions. Gift-card rules never contribute.
- The shopper selector and store pages show one grouped label only when complete rule profiles match.
  Exact URL-detected categories remain the internal calculation value; manual multi-category group
  selection requires an exact-category refinement instead of inventing a classification.
- Internal wildcard `All` remains hidden while legitimate `All Footwear` remains visible.
- Global navigation now includes accessible desktop/mobile WhatsApp support to +91 9156968318.
  Contact and footer mail links consistently use `yukticart@gmail.com` while the existing feedback
  endpoint remains unchanged.
- Focused verification: 7/7 DB-write-free grouping/contact tests, Python compile, frontend production
  build, and isolated shopper-flow smoke passed. No data, collections, assets, or deployment created.

## Implemented (2026-10-07) — Contact Delivery + Import Semantics Phase 1A
- Contact Us now requires a valid visitor email, persists through the existing `feedback` collection,
  sends a fixed server-side YuktiCart notification through the managed Resend transport, and records
  `pending` → `sent` or `failed` delivery state. Frontend success appears only after confirmed send.
- Email recipient, sender name, key and owner-controlled Reply-To are backend environment settings;
  user content is escaped and checked by a structural email safety gate. No frontend secret or new
  persistence system was added.
- Spreadsheet imports accept an optional explicit `Both` column. Both-only produces one `both` rule;
  equal New/Existing values remain two rules; mixing Both with either typed column is NEEDS REVIEW.
- Exact category matching, grouped expansion, visible source warnings, internal `All`, exact
  `All Footwear`, publish filtering, history and rollback behavior remain intact.
- Focused verification: 28/28 relevant tests, Python compile, frontend build, isolated UI rendering, and
  one provider transport test to `delivered@resend.dev` passed. No production recipient test, data
  migration, seed, deployment or unrelated UI work was performed.

## Backlog (prioritized)
- **P1:** MFA for admins; email verification flow; password reset UI; recent-login reauth for role
  changes. Full keyboard cell editing / multi-select / fill-down in the Rate Matrix grid.
- **P2:** Draft→publish workflow surfaced in Matrix; per-store rate versioning UI; category
  corrections analytics dashboard; OG image assets per route; split server.py into routers.
- **P2:** rate_editor/viewer role management UI (backend roles already enforced).

## Next tasks
See Next Action Items in the delivery summary.
