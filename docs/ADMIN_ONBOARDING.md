# Administrator Onboarding

## 1. Bootstrap the owner (one-time)
Set in `backend/.env`:
```
ADMIN_EMAIL="owner@yourdomain.com"
ADMIN_PASSWORD="a-strong-password"
ADMIN_ALLOWLIST="owner@yourdomain.com"
```
On startup the server creates this owner and assigns the `owner` role. Open admin registration is
disabled — nobody can self-claim admin. Remove the email from `ADMIN_ALLOWLIST` after first login
if you want to freeze bootstrap.

## 2. First sign-in
Go to `/admin/login`, sign in with the owner credentials. You land on the Console dashboard with a
first-time checklist and live counts.

## 3. Recommended checklist
1. **Review platforms** — confirm affiliate & gift-card platforms (`/admin/platforms`).
2. **Review stores & domain aliases** — add domains so URL detection works (`/admin/stores`, expand a store).
3. **Review categories & keyword rules** — tune weighted keywords/exclusions (`/admin/categories`).
4. **Set stacking & split-payment policy** — per store (edit store → settings).
5. **Import or create rates** — use the Rate Matrix bulk paste or the Rate Editor.
6. **Preview** — open the public homepage and run a test order.

## 4. Daily rate updates (Amazon/Flipkart)
Use **Rate Matrix** (`/admin/matrix`):
- Pick store + platform + customer type.
- Paste a spreadsheet table (`Category<TAB>Rate`, or rich columns). See `docs/rate_matrix_template.csv`.
- Click **Preview import** → review new/changed/unchanged/invalid/unmatched rows.
- Click **Publish rows atomically** → public site updates immediately.
- If wrong, use **Rollback** in Import history to revert the whole batch.
- Export current rates to CSV anytime.

## 5. Individual edits
Use **Rate Editor** (`/admin/rates`) for single rates: platform/store/category, customer type,
percent or flat, MOV, cap, validity dates, priority, notes, active/draft. Duplicate/archive supported.
