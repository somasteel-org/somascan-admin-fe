# Operator APIs - Current Reference

## 1. Scope

This document lists all APIs currently usable by operator accounts:
- `COMPANY_OPERATOR`
- `PORT_OPERATOR`

It also explains the lifecycle logic behind each endpoint and how to consume these APIs safely from a mobile app.

## 2. Authentication and Access Rules

## 2.1 Login

### Endpoint
- `POST /api/login`

### Body
```json
{
  "email": "company.operator@truck.local",
  "password": "password",
  "device_name": "flutter-device"
}
```

### Success response shape
```json
{
  "success": true,
  "data": {
    "token": "...",
    "user": {
      "id": 2,
      "name": "Company Operator",
      "email": "company.operator@truck.local",
      "role": "COMPANY_OPERATOR",
      "location": "COMPANY"
    },
    "expires_at": "2026-..."
  },
  "message": "Login successful",
  "errors": null
}
```

### Notes
- Use token as `Authorization: Bearer <token>`.
- Token expiration is controlled by `SANCTUM_EXPIRATION`.

## 2.2 Current user

### Endpoint
- `GET /api/me`

### Purpose
- Retrieve current authenticated operator profile and role/location.

## 2.3 Logout

### Endpoint
- `POST /api/logout`

### Purpose
- Revoke current access token.

## 3. Operator Functional Endpoints

## 3.1 Scan truck QR

### Endpoint
- `POST /api/scan`

### Access
- `COMPANY_OPERATOR` and `PORT_OPERATOR`
- Rate limited: `30 requests / minute`

### Body
```json
{
  "qr_code": "TRUCK-001",
  "device_time": "2026-03-26T10:10:10Z",
  "device_id": "pixel-7-abc"
}
```

### Success response shape
```json
{
  "success": true,
  "data": {
    "status": "SUCCESS",
    "message": "Scan successful",
    "current_step": "ARRIVED_PORT",
    "next_expected_step": "LEFT_PORT",
    "is_locked": true,
    "trip_summary": {
      "trip_id": 12,
      "truck_id": 1,
      "status": "ARRIVED_PORT",
      "truck": {
        "id": 1,
        "registration_number": "REG-001"
      },
      "action": "ARRIVE",
      "timestamps": {
        "started_at": "...",
        "arrived_port_at": "...",
        "left_port_at": null,
        "completed_at": null
      }
    }
  },
  "message": "Scan successful",
  "errors": null
}
```

### Scan lifecycle logic
- System finds truck by QR code.
- Truck must be active (`is_active = true`).
- Active trip is fetched with DB row lock.
- Expected action is derived from current trip status:
  - no active trip => `START`
  - `STARTED` => `ARRIVE`
  - `ARRIVED_PORT` => `LEAVE`
  - `LEFT_PORT` => `RETURN`
- Role/location checks:
  - `START` and `RETURN`: only `COMPANY_OPERATOR` at `COMPANY`
  - `ARRIVE` and `LEAVE`: only `PORT_OPERATOR` at `PORT`
- Duplicate same action in 10-second window is rejected.
- Extra strict guard: `ARRIVED_PORT -> LEFT_PORT` is rejected if attempted in less than 5 seconds after `arrived_port_at`.
- Transition and scan log are written inside a DB transaction.

### Common error cases
- 404: truck not found by QR code
- 422: truck inactive
- 403: wrong role/location for expected step
- 409: scan too fast / duplicate retry / transition timing blocked

### Error response shape
```json
{
  "success": false,
  "data": null,
  "message": "Scan trop rapide, veuillez patienter.",
  "errors": {
    "scan": "Scan trop rapide, veuillez patienter."
  }
}
```

## 3.2 Operator last scans

### Endpoint
- `GET /api/operator/last-scans?limit=10`

### Access
- `COMPANY_OPERATOR` and `PORT_OPERATOR`

### Response shape
```json
{
  "success": true,
  "data": [
    {
      "id": 91,
      "action": "ARRIVED_PORT",
      "scanned_at": "2026-03-26T10:11:00Z",
      "truck": {
        "id": 1,
        "registration_number": "REG-001"
      }
    }
  ],
  "message": null,
  "errors": null
}
```

### Notes
- `limit` is clamped between `1` and `100`.
- `action` is mapped to UI-friendly lifecycle labels:
  - `START` => `STARTED`
  - `ARRIVE` => `ARRIVED_PORT`
  - `LEAVE` => `LEFT_PORT`
  - `RETURN` => `COMPLETED`
- `truck` object is always returned (never null). When relation is missing, backend returns fallback values.

## 3.3 Basic truck details

### Endpoint
- `GET /api/trucks/{truck}/basic`

### Access
- `ADMIN`, `COMPANY_OPERATOR`, `PORT_OPERATOR`

### Response shape
```json
{
  "success": true,
  "data": {
    "id": 1,
    "registration_number": "REG-001",
    "qr_code": "TRUCK-001",
    "is_active": true,
    "active_trip_status": "STARTED"
  },
  "message": null,
  "errors": null
}
```

## 4. Operator data model hints for Flutter

Use this simple local model mapping:
- `current_step` => current lifecycle state
- `next_expected_step` => next UI action guidance
- `is_locked` => backend safety lock hint to block immediate rescan in UI
- `trip_summary.truck.registration_number` => label on card
- `trip_summary.status` => direct lifecycle status for current trip state
- `trip_summary.timestamps` => timeline display
- `operator/last-scans[].action` => history badges

No additional mobile-side business mapping is required for these fields.

## 5. Important route visibility note

Even though `/api/trips/active` returns operator-friendly resource format, it is currently protected under admin role in route definitions. Operators should rely on:
- `/api/scan`
- `/api/operator/last-scans`
- `/api/trucks/{truck}/basic`

If needed, route policy can be changed later to expose `/api/trips/active` to operators.

## 6. Quick test users (seeded)

- Company operator: `company.operator@truck.local` / `password`
- Port operator: `port.operator@truck.local` / `password`

---

# 7. Admin APIs - Detailed Reference

This section centralizes all ADMIN endpoints in the same document.

## 7.1 Global rules

- All admin endpoints are under `/api`.
- Auth required: `Authorization: Bearer <token>`.
- Admin role required on protected routes.
- Standard response envelope:

```json
{
  "success": true,
  "data": {},
  "message": "Optional",
  "errors": null
}
```

## 7.2 Admin authentication APIs

### `POST /api/login`

Purpose:
- Authenticate admin and issue Sanctum token.

Body:
```json
{
  "email": "admin@truck.local",
  "password": "password",
  "device_name": "admin-dashboard"
}
```

Validation:
- `email`: required, valid email
- `password`: required
- `device_name`: optional, max 255

Logic:
- Validates credentials.
- Creates token with configured expiration (`SANCTUM_EXPIRATION`).

### `POST /api/logout`

Purpose:
- Revoke current token.

Logic:
- Deletes current access token.

### `GET /api/me`

Purpose:
- Return current authenticated admin profile.

## 7.3 Truck Management (ADMIN)

### `GET /api/trucks`

Purpose:
- List trucks with pagination/filtering.

Query:
- `limit` (1..100)
- `page`
- `is_active` (true/false)

Logic:
- Returns latest-first paginated truck list.

### `POST /api/trucks`

Purpose:
- Create truck.

Body:
```json
{
  "registration_number": "REG-100",
  "qr_code": "TRUCK-100",
  "is_active": true
}
```

Validation:
- `registration_number`: required, unique
- `qr_code`: optional, unique
- `is_active`: optional boolean

Logic:
- If `qr_code` missing, backend auto-generates it.

### `GET /api/trucks/{truck}`

Purpose:
- Get one truck by id.

### `PUT|PATCH /api/trucks/{truck}`

Purpose:
- Update truck fields.

Allowed fields:
- `registration_number`
- `qr_code`
- `is_active`

### `DELETE /api/trucks/{truck}`

Purpose:
- Delete truck.

### `POST /api/trucks/{truck}/generate-qr`

Purpose:
- Regenerate truck QR code.

### `PATCH /api/trucks/{truck}/activate`

Purpose:
- Set `is_active=true`.

### `PATCH /api/trucks/{truck}/deactivate`

Purpose:
- Set `is_active=false`.

## 7.4 User Management (ADMIN)

### `GET /api/users`

Purpose:
- List users/operators with filters.

Query:
- `limit` (1..100)
- `page`
- `role`
- `location`

### `POST /api/users`

Purpose:
- Create admin or operator account.

Body:
```json
{
  "name": "New Operator",
  "email": "new.operator@truck.local",
  "password": "secret123",
  "role": "PORT_OPERATOR",
  "location": "PORT"
}
```

Validation:
- `name`: required
- `email`: required, unique
- `password`: required, min 8
- `role`: one of `ADMIN|COMPANY_OPERATOR|PORT_OPERATOR`
- `location`: nullable, one of `COMPANY|PORT`

Logic:
- Password is hashed before save.

### `GET /api/users/{user}`

Purpose:
- Get one user by id.

### `PUT|PATCH /api/users/{user}`

Purpose:
- Update user data, role, location, or password.

Logic:
- Password is re-hashed when provided.

### `DELETE /api/users/{user}`

Purpose:
- Delete user.

## 7.5 Trip Monitoring (ADMIN)

### `GET /api/trips`

Purpose:
- List trips with filters and enriched fields.

Query:
- `limit` (1..100)
- `page`
- `status`
- `truck_id`
- `from`
- `to`

Returned enrichments:
- `next_expected_step`
- `current_location`
- `last_scan_at`
- `durations`
- nested `truck` with id and registration

### `GET /api/trips/{trip}`

Purpose:
- Get one enriched trip.

### `GET /api/trips/active`

Purpose:
- View active trips snapshot.

### `GET /api/trips/history`

Purpose:
- View completed trip history.

### `GET /api/trips/{trip}/logs`

Purpose:
- View scan timeline for a specific trip.

## 7.6 Reports (ADMIN)

### `GET /api/reports/summary`

Purpose:
- KPI summary:
  - total trucks
  - total trips
  - active/completed trips
  - delayed trips
  - status breakdown
  - average durations

### `GET /api/reports/truck/{truck}`

Purpose:
- Per-truck report with trips and durations.

### `GET /api/reports/durations`

Purpose:
- Duration-focused metrics.

### `GET /api/reports/delays`

Purpose:
- Delay analysis based on threshold logic.

### `GET /api/reports/export`

Purpose:
- Export-ready payload containing summary/durations/delays.

## 7.7 Shared endpoint (ADMIN + operators)

### `GET /api/trucks/{truck}/basic`

Purpose:
- Lightweight truck status card.

## 7.8 How to deal with admin APIs

1. Login and verify role via `/api/me`.
2. Use server-side pagination (`limit`, `page`) on list pages.
3. Use backend filters for trips/users to keep UI fast.
4. Handle expected error codes:
   - `401` unauthenticated
   - `403` forbidden (role)
   - `422` validation
   - `404` not found
   - `409` conflict (timing/scan guards)
5. For operations dashboard:
   - active state: `/api/trips/active`
   - audit trail: `/api/trips/{id}/logs`
   - analytics: `/api/reports/*`

## 7.9 Admin seeded account

- `admin@truck.local` / `password`
