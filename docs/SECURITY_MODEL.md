# YuktiCart Security Model & Permission Matrix

## Authentication
- Email + password, bcrypt-hashed. JWT access token (8h) + refresh token (7d) issued as
  httpOnly, Secure, SameSite=None cookies; access token also returned for Bearer usage.
- Brute-force protection: 5 failed attempts per {ip:email} → 15-minute lockout.
- Open administrator registration is DISABLED. The initial owner is bootstrapped on startup only
  if `ADMIN_EMAIL` is present in the `ADMIN_ALLOWLIST` env var. Roles live in the `user_roles`
  collection, never in the browser or a user-editable profile field.

## Authorization (server-enforced on every request)
Roles: `owner`, `admin`, `rate_editor`, `viewer`.

| Capability                                   | owner | admin | rate_editor | viewer | anon |
|----------------------------------------------|:-----:|:-----:|:-----------:|:------:|:----:|
| Read public selectors / calculate / detect   |  ✓    |  ✓    |     ✓       |   ✓    |  ✓   |
| Read admin lists (platforms/stores/rates…)   |  ✓    |  ✓    |     ✓       |   ✓    |  ✗   |
| Create/edit/archive platforms/stores/cats    |  ✓    |  ✓    |     ✓       |   ✗    |  ✗   |
| Create/edit/archive/import/rollback rates     |  ✓    |  ✓    |     ✓       |   ✗    |  ✗   |
| View audit log / corrections / feedback      |  ✓    |  ✓    |     ✓       |   ✗    |  ✗   |

Write endpoints require `WRITE_ROLES = {owner, admin, rate_editor}`; management reads require a
non-empty role set. Unauthenticated access to any `/api/admin/*` route returns 401; a signed-in
user without a sufficient role returns 403. The frontend route guard is UX only — it is never the
security boundary.

## Data integrity & auditing
- All create/update/archive/restore/import/rollback actions write an append-only `audit_log`
  entry with actor, action, entity, before/after JSON, request id and timestamp.
- Reference data uses soft-delete (`archived_at`) so historical rates remain intact; archived items
  are excluded from public selectors and calculation.
- Rate imports run as a batch: superseded rates are archived and new rates tagged with the batch id;
  one-click rollback deletes inserted rows and restores superseded ones.
- Inputs are validated/normalized server-side (non-negative money, valid date ranges, unique names).

## Secrets
- `JWT_SECRET`, DB creds and admin bootstrap credentials come only from environment variables and
  are never exposed to the browser.
