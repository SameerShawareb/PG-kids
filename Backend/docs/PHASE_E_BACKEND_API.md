# Phase E Backend API

## New / Extended Endpoints

### Auth

#### GET `/api/auth/me`
- Auth: Bearer token
- Response user fields: `id, name, email, phone, preferred_language, role, is_active, has_parent_pin, createdAt, updatedAt`
- Sensitive fields excluded (`password_hash`, `parent_pin_hash`, token internals)

#### PATCH `/api/auth/me`
- Auth: Bearer token
- Allowed body fields only: `name, email, phone, preferred_language`
- `current_password` is allowed only when changing email
- Validation:
  - unknown fields rejected (400)
  - email format + unique (409 on duplicate)
  - phone format (nullable)
  - language enum: `en|ar`
  - role/status/password updates are not accepted
- Audit: `USER_PROFILE_UPDATED`

#### PATCH `/api/auth/change-password`
- Auth: Bearer token
- Rate limited
- Body: `{ current_password, new_password, confirm_password }`
- Rules:
  - current password must match
  - min length 8
  - confirmation required
  - no password reuse
- Persistence:
  - updates `password_hash`
  - sets `password_changed_at`
- Audit: `USER_PASSWORD_CHANGED`
- Response includes `requires_relogin: true`

#### PUT `/api/auth/parent-pin`
- Auth: Bearer token
- Body: `{ current_password?, current_pin?, new_pin, confirm_pin }`
- Rules:
  - PIN numeric 4-6 digits
  - trivial PINs rejected
  - no existing PIN: require `current_password`
  - existing PIN: require either `current_pin` or `current_password`
- Persistence:
  - stores bcrypt hash in `parent_pin_hash`
  - updates `parent_pin_updated_at`
- Audit: `PARENT_PIN_SET` or `PARENT_PIN_CHANGED`

#### POST `/api/auth/parent-pin/verify`
- Auth: Bearer token
- Rate limited
- Body: `{ pin }`
- Returns short-lived unlock token (purpose `parent_unlock`, default 5 minutes)
- Generic failure response for invalid/no PIN
- Audit: `PARENT_PIN_VERIFIED`

#### DELETE `/api/auth/parent-pin`
- Auth: Bearer token
- Body: `{ current_password? | current_pin? }`
- Response contract:
  - `409 Conflict` when no Parent PIN exists: `message: "No parent PIN is configured"`, `data: { has_parent_pin: false }`
  - `400 Bad Request` when no credential is provided
  - `401 Unauthorized` when supplied credential is invalid
  - `200 OK` only after actual successful removal: `data: { has_parent_pin: false }`
- Clears PIN hash fields only after successful credential verification
- Audit: `PARENT_PIN_REMOVED` (written only after actual removal)

---

### Child Profile Safety

#### GET `/api/child-profiles/:profileId/safety`
#### PATCH `/api/child-profiles/:profileId/safety`
- Also available through alias mount: `/api/profiles/:profileId/safety`
- Auth: parent only, owner of profile
- PATCH requires header: `x-parent-unlock-token`
- Supported enforceable setting:
  - `profile_locked` (boolean)
- Enforcement points:
  - browse filtering with `profileId` in `content-search.controller`
  - playback access in `contentAccess.assertChildProfileAccess`
  - locked profiles require valid parent-unlock token
- Audit: `CHILD_PROFILE_SAFETY_UPDATED`

---

### Admin Plans

#### GET `/api/plans/admin?archive_status=active|archived|all`
- Auth: admin
- Default behavior unchanged: missing `archive_status` => `active` only
- Invalid `archive_status` => 400
- Pagination + stable ordering preserved

#### PATCH `/api/plans/admin/:planId/restore`
- Auth: admin
- Restores archived plan (`is_archived=false`, `archived_at=null`)
- Idempotent behavior if already active
- Audit: `SUBSCRIPTION_PLAN_RESTORED`

---

### Admin Content

#### GET `/api/admin/content?archive_status=active|archived|all&keyword=&type=&categoryId=&seriesId=&is_published=&access_level=`
- Auth: admin/content_manager
- Default behavior unchanged: active/non-archived only
- Invalid `archive_status` => 400
- Combines existing filters with archive scope
- Safe DTO only (no filesystem/internal URLs)

#### PATCH `/api/admin/content/:contentId/restore`
- Auth: admin/content_manager
- Restores archived content (`is_archived=false`, `archived_at=null`)
- Reactivates related episode records
- Audit: `CONTENT_RESTORED`

---

### Admin Users

#### GET `/api/admin/users`
- Auth: admin
- Query: `page, limit, search, role, status`
- Returns safe account fields + current subscription summary

#### GET `/api/admin/users/:userId`
- Auth: admin
- Returns safe account details + current subscription summary + child profile total

#### PATCH `/api/admin/users/:userId/status`
- Auth: admin
- Body: `{ is_active: boolean }`
- Guards:
  - cannot deactivate own account
  - cannot deactivate last active admin
- Audit: `ADMIN_USER_ACTIVATED` / `ADMIN_USER_DEACTIVATED`

---

## Database Fields Added (Phase E)

### `users`
- `phone` (nullable string)
- `preferred_language` (nullable string)
- `is_active` (boolean, default true)
- `password_changed_at` (nullable date)
- `parent_pin_hash` (nullable string, bcrypt hash)
- `parent_pin_updated_at` (nullable date)

### `child_profiles`
- `profile_locked` (boolean, default false)

Indexes added idempotently in schema script for new status/filter columns.

---

## Schema Delivery

- Script: `scripts/apply-phase-e-schema.js`
- NPM: `npm run db:phase-e`
- Idempotent checks for columns and indexes before creation
- Non-destructive (no drop/rename)

---

## Security Notes

- Inactive users are blocked in login and auth middleware
- Auth token invalidation on password change uses `password_changed_at` vs token `iat`
- Parent unlock token uses dedicated `purpose: parent_unlock` claim with short TTL
- Password/PIN values and hashes are never returned in API responses
- Audit metadata excludes sensitive values

---

## Known Limitations

- Child safety scope intentionally limited to enforceable `profile_locked`
- No global profile session state is stored server-side
- Frontend integration for unlock-token header usage is pending in a later phase
