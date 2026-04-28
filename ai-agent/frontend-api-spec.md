# Admin APIs - Communication Guide

## 1. Purpose

This document explains how to communicate with the current admin APIs in this backend.

It includes for each endpoint:
- when to call it
- required auth
- input format
- key response fields
- how to handle errors

## 2. Base Setup

## 2.1 Base URL
Use your backend URL plus `/api`.

Example:
- `http://127.0.0.1:8000/api`

## 2.2 Common Headers
For public login:
- `Content-Type: application/json`
- `Accept: application/json`

For authenticated endpoints:
- `Content-Type: application/json`
- `Accept: application/json`
- `Authorization: Bearer <TOKEN>`

## 2.3 Standard Response Format
Success:

```json
{
  "success": true,
  "data": {},
  "message": "Optional",
  "errors": null
}
```

Error:

```json
{
  "success": false,
  "data": null,
  "message": "...",
  "errors": {}
}
```

## 2.4 HTTP Codes to Handle
- `200` success
- `201` created
- `401` token missing/invalid/expired
- `403` role not allowed
- `404` not found
- `422` validation failure

## 3. Auth APIs

## 3.1 POST /api/login
When to call:
- first login step for admin dashboard.

Body:

```json
{
  "email": "admin@truck.local",
  "password": "password",
  "device_name": "admin-web"
}
```

Success data:
- `token`
- `user`
- `expires_at`

How to deal with it:
- persist token securely
- call `GET /api/me` right after login to confirm role is `ADMIN`
- if login fails, show credentials error

## 3.2 POST /api/logout
When to call:
- on logout action.

How to deal with it:
- call endpoint with bearer token
- clear local token and user cache after success

## 3.3 GET /api/me
When to call:
- after login
- on app bootstrap/token restore

How to deal with it:
- if role is not `ADMIN`, block admin UI
- if `401`, redirect to login

## 4. Trucks APIs (ADMIN)

## 4.1 GET /api/trucks
When to call:
- trucks list page.

Query params:
- `limit` (1..100)
- `page`
- `is_active` (`true` or `false`)

How to deal with it:
- use server pagination controls from response meta
- keep filters in URL/query state

## 4.2 POST /api/trucks
When to call:
- create truck form submit.

Body:

```json
{
  "registration_number": "REG-100",
  "qr_code": "TRUCK-100",
  "is_active": true
}
```

Rules:
- `registration_number` required and unique
- `qr_code` optional, unique if present

How to deal with it:
- display field errors from `422`
- refresh trucks table after `201`

## 4.3 GET /api/trucks/{truck}
When to call:
- details page and edit preload.

## 4.4 PUT/PATCH /api/trucks/{truck}
When to call:
- save truck edits.

Body:
- any of `registration_number`, `qr_code`, `is_active`

How to deal with it:
- on success replace local truck item with returned object
- on `422` show per-field messages

## 4.5 DELETE /api/trucks/{truck}
When to call:
- delete confirmation action.

How to deal with it:
- optimistic remove from table or refetch list

## 4.6 POST /api/trucks/{truck}/generate-qr
When to call:
- QR regeneration action.

How to deal with it:
- update displayed QR value with returned `data.qr_code`

## 4.7 PATCH /api/trucks/{truck}/activate
When to call:
- activate action in truck row/details.

## 4.8 PATCH /api/trucks/{truck}/deactivate
When to call:
- deactivate action in truck row/details.

## 4.9 GET /api/trucks/{truck}/basic
When to call:
- quick status preview card.

Returns:
- `id`
- `registration_number`
- `qr_code`
- `is_active`
- `active_trip_status`

## 5. Users APIs (ADMIN)

## 5.1 GET /api/users
When to call:
- users/operators management list.

Query params:
- `limit`
- `page`
- `role`
- `location`

How to deal with it:
- filter by role/location from UI dropdowns
- use pagination controls

## 5.2 POST /api/users
When to call:
- create admin/operator form.

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

Rules:
- password min 8
- role in `ADMIN|COMPANY_OPERATOR|PORT_OPERATOR`
- location nullable, in `COMPANY|PORT`

How to deal with it:
- do basic frontend validation but trust backend as source of truth

## 5.3 GET /api/users/{user}
When to call:
- user details/edit preload.

## 5.4 PUT/PATCH /api/users/{user}
When to call:
- save role/location/profile/password changes.

How to deal with it:
- sending `password` updates it (rehashed backend side)

## 5.5 DELETE /api/users/{user}
When to call:
- remove account action.

How to deal with it:
- avoid deleting currently logged-in admin account from UI flow

## 6. Trips APIs (ADMIN)

## 6.1 GET /api/trips
When to call:
- full trip monitoring table.

Query params:
- `limit`
- `page`
- `status`
- `truck_id`
- `from`
- `to`

Returns enriched trip resource fields:
- `status`
- `next_expected_step`
- `current_location`
- `last_scan_at`
- `durations`
- nested `truck`

How to deal with it:
- use backend-calculated fields directly in UI
- no extra lifecycle mapping needed on frontend

## 6.2 GET /api/trips/{trip}
When to call:
- trip details panel/page.

## 6.3 GET /api/trips/active
When to call:
- live operations dashboard.

Query params:
- `limit`

How to deal with it:
- poll periodically for live cards
- render `current_location` and `next_expected_step` directly

## 6.4 GET /api/trips/history
When to call:
- completed trips tab/report list.

## 6.5 GET /api/trips/{trip}/logs
When to call:
- audit timeline per trip.

Returns:
- mapped action labels
- scan timestamp
- truck information

## 7. Reports APIs (ADMIN)

## 7.1 GET /api/reports/summary
When to call:
- dashboard top cards and overview charts.

Typical fields:
- totals
- active/completed counts
- delayed trips
- average durations

## 7.2 GET /api/reports/truck/{truck}
When to call:
- deep analysis for one truck.

## 7.3 GET /api/reports/durations
When to call:
- duration analytics widgets.

## 7.4 GET /api/reports/delays
When to call:
- delay/bottleneck widgets.

## 7.5 GET /api/reports/export
When to call:
- export/report generation flow.

How to deal with it:
- payload already grouped (`summary`, `durations`, `delays`)

## 8. Scan Logic Notes for Admin Monitoring

The scan endpoint is operator-only, but admins depend on its data quality.

Current guarantees:
- one active trip per truck at a time
- many trucks can be active simultaneously
- strict lifecycle order
- role/location enforcement
- truck existence and active-state checks
- DB transaction and row locking for consistency

Current behavior note:
- extra timing/idempotency 409 restrictions are not enforced right now

## 9. Recommended Integration Flow

1. Login flow:
- call `/api/login`
- save token
- call `/api/me`
- verify role is `ADMIN`

2. Dashboard boot:
- load `/api/reports/summary`
- load `/api/trips/active`
- load `/api/trucks?limit=...`

3. Management screens:
- Trucks: `/api/trucks` + activate/deactivate + generate-qr
- Users: `/api/users` CRUD
- Trips: `/api/trips` + `/api/trips/{id}/logs`

4. Error UX:
- 401 => redirect login
- 403 => show permission error
- 422 => bind field errors
- 404 => show not found state

## 10. Seeded Admin Account

- Email: `admin@truck.local`
- Password: `password`

## 11. Current Admin Endpoint Checklist

Auth:
- POST `/api/login`
- POST `/api/logout`
- GET `/api/me`

Trucks:
- GET `/api/trucks`
- POST `/api/trucks`
- GET `/api/trucks/{truck}`
- PUT/PATCH `/api/trucks/{truck}`
- DELETE `/api/trucks/{truck}`
- POST `/api/trucks/{truck}/generate-qr`
- PATCH `/api/trucks/{truck}/activate`
- PATCH `/api/trucks/{truck}/deactivate`
- GET `/api/trucks/{truck}/basic`

Users:
- GET `/api/users`
- POST `/api/users`
- GET `/api/users/{user}`
- PUT/PATCH `/api/users/{user}`
- DELETE `/api/users/{user}`

Trips:
- GET `/api/trips`
- GET `/api/trips/{trip}`
- GET `/api/trips/active`
- GET `/api/trips/history`
- GET `/api/trips/{trip}/logs`

Reports:
- GET `/api/reports/summary`
- GET `/api/reports/truck/{truck}`
- GET `/api/reports/durations`
- GET `/api/reports/delays`
- GET `/api/reports/export`

## 12. Request and Response Templates

This section gives concrete request patterns and key parameters.

## 12.1 Auth

### POST /api/login
Parameters:
- Body:
  - `email` (required)
  - `password` (required)
  - `device_name` (optional)

Example request:
```http
POST /api/login
Content-Type: application/json
Accept: application/json

{
  "email": "admin@truck.local",
  "password": "password",
  "device_name": "admin-web"
}
```

Example response:
```json
{
  "success": true,
  "data": {
    "token": "...",
    "user": {
      "id": 1,
      "name": "System Admin",
      "email": "admin@truck.local",
      "role": "ADMIN",
      "location": null
    },
    "expires_at": "2026-..."
  },
  "message": "Login successful",
  "errors": null
}
```

### POST /api/logout
Parameters:
- Headers:
  - `Authorization: Bearer <TOKEN>`

Example response:
```json
{
  "success": true,
  "data": null,
  "message": "Logout successful",
  "errors": null
}
```

### GET /api/me
Parameters:
- Headers:
  - `Authorization: Bearer <TOKEN>`

## 12.2 Trucks

### GET /api/trucks
Parameters:
- Query:
  - `limit` (optional)
  - `page` (optional)
  - `is_active` (optional, `true|false`)

Example request:
```http
GET /api/trucks?limit=20&page=1&is_active=true
Authorization: Bearer <TOKEN>
Accept: application/json
```

### POST /api/trucks
Parameters:
- Body:
  - `registration_number` (required)
  - `qr_code` (optional)
  - `is_active` (optional)

Example body:
```json
{
  "registration_number": "REG-110",
  "qr_code": "TRUCK-110",
  "is_active": true
}
```

### GET /api/trucks/{truck}
Parameters:
- Path:
  - `truck` (required, truck id)

### PUT/PATCH /api/trucks/{truck}
Parameters:
- Path:
  - `truck` (required)
- Body (one or more):
  - `registration_number`
  - `qr_code`
  - `is_active`

### DELETE /api/trucks/{truck}
Parameters:
- Path:
  - `truck` (required)

### POST /api/trucks/{truck}/generate-qr
Parameters:
- Path:
  - `truck` (required)

### PATCH /api/trucks/{truck}/activate
Parameters:
- Path:
  - `truck` (required)

### PATCH /api/trucks/{truck}/deactivate
Parameters:
- Path:
  - `truck` (required)

### GET /api/trucks/{truck}/basic
Parameters:
- Path:
  - `truck` (required)

## 12.3 Users

### GET /api/users
Parameters:
- Query:
  - `limit` (optional)
  - `page` (optional)
  - `role` (optional)
  - `location` (optional)

### POST /api/users
Parameters:
- Body:
  - `name` (required)
  - `email` (required)
  - `password` (required)
  - `role` (required: `ADMIN|COMPANY_OPERATOR|PORT_OPERATOR`)
  - `location` (optional: `COMPANY|PORT`)

Example body:
```json
{
  "name": "Port Operator 2",
  "email": "port2@truck.local",
  "password": "secret123",
  "role": "PORT_OPERATOR",
  "location": "PORT"
}
```

### GET /api/users/{user}
Parameters:
- Path:
  - `user` (required, user id)

### PUT/PATCH /api/users/{user}
Parameters:
- Path:
  - `user` (required)
- Body:
  - any updatable field from create user

### DELETE /api/users/{user}
Parameters:
- Path:
  - `user` (required)

## 12.4 Trips

### GET /api/trips
Parameters:
- Query:
  - `limit` (optional)
  - `page` (optional)
  - `status` (optional)
  - `truck_id` (optional)
  - `from` (optional, date)
  - `to` (optional, date)

### GET /api/trips/{trip}
Parameters:
- Path:
  - `trip` (required, trip id)

### GET /api/trips/active
Parameters:
- Query:
  - `limit` (optional)

### GET /api/trips/history
Parameters:
- Query:
  - `limit` (optional)
  - `page` (optional)

### GET /api/trips/{trip}/logs
Parameters:
- Path:
  - `trip` (required)

## 12.5 Reports

### GET /api/reports/summary
Parameters:
- none

### GET /api/reports/truck/{truck}
Parameters:
- Path:
  - `truck` (required)

### GET /api/reports/durations
Parameters:
- none

### GET /api/reports/delays
Parameters:
- none

### GET /api/reports/export
Parameters:
- none

## 12.6 Generic Error Example (422)

```json
{
  "success": false,
  "data": null,
  "message": "The given data was invalid.",
  "errors": {
    "email": [
      "The email field is required."
    ]
  }
}
```
