# YuktiCart

A tactical shopping savings & checkout-stack engine for Indian shoppers. Paste a product URL (or
pick a store + category), enter MRP and selling price, choose new/existing customer, and get the
mathematically best payment route by stacking affiliate cashback, discounted gift cards, store
discounts, MOV, caps and store-specific stacking / split-payment policies.

## Stack
- **Frontend:** React 19, Tailwind CSS, Lucide icons, Framer Motion, shadcn/ui, react-router.
- **Backend:** FastAPI, Motor (MongoDB), PyJWT, bcrypt. Decimal-safe money math.
- **DB:** MongoDB (normalized collections with server-side authorization + append-only audit log).

## Run (already supervised in this environment)
- Backend on `0.0.0.0:8001`, frontend on `3000` via supervisor.
- `sudo supervisorctl restart backend|frontend` after `.env` or dependency changes.
- All API routes are prefixed `/api`. Frontend uses `REACT_APP_BACKEND_URL`.

## Environment
Copy `backend/.env.example` and `frontend/.env.example` and fill values. Never commit secrets.
`ADMIN_ALLOWLIST` bootstraps the initial owner (open admin registration is disabled).

## Seed vs production data
Seed data lives in `backend/seed.py` and is inserted only when a collection is empty (idempotent),
clearly separated from anything an admin creates via the console.

## Three visual directions
On first load a selector lets the owner preview Black & Gold (default), Cyber Obsidian, and Light
Editorial. The choice is applied across the public site, results, auth, and console via semantic
design tokens. Change anytime via the palette icon in the nav.

## Docs
- `docs/CALCULATION_RULES.md` — rules + Firstcry worked example.
- `docs/SECURITY_MODEL.md` — auth + permission matrix.
- `docs/ADMIN_ONBOARDING.md` — owner bootstrap + daily rate workflow.
- `docs/rate_matrix_template.csv` — bulk import template.

## Tests
Backend pytest at `backend/tests/backend_test.py` covers rate math, MOV/caps, category precedence,
new/existing differences, stacking, split payments, rounding, imports, permissions and audit.

## Admin console
`/admin/login` → dashboard, Rate Editor, Rate Matrix (bulk paste + preview + publish + rollback +
CSV), Platforms, Stores & Domains, Categories & Keywords, Audit Log.
