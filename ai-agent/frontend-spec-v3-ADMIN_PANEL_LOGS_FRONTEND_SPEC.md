# Admin Panel Logs - Frontend Update Specification

## 1. Purpose

This document defines the frontend integration contract for the new admin logs section.

Goal:
- Allow admin users to view and filter full scan traceability per operator and per trip/truck.

## 2. New Endpoint

Method:
- GET /api/scan-logs

Access:
- ADMIN role only (Bearer token required)

## 3. Query Parameters

All are optional unless noted.

Pagination:
- limit: integer, min 1, max 100, default 20
- page: integer, min 1

Direct filters:
- user_id: integer (users.id)
- truck_id: integer (trucks.id)
- trip_id: integer (trips.id)
- role: ADMIN | COMPANY_OPERATOR | PORT_OPERATOR
- location: COMPANY | PORT
- action: START | ARRIVE | LEAVE | RETURN
- registration_number: string (partial match)

Date filters:
- from: date (YYYY-MM-DD)
- to: date (YYYY-MM-DD), must be >= from

Global search:
- search: string (matches operator name/email, truck registration/driver/qr, device id)

## 4. Request Example

GET /api/scan-logs?limit=25&page=1&role=PORT_OPERATOR&action=ARRIVE&from=2026-03-01&to=2026-03-31&search=ismail

Headers:
- Accept: application/json
- Authorization: Bearer <ADMIN_TOKEN>

## 5. Response Contract

Top-level response wrapper is unchanged:
- success
- data
- message
- errors

Inside data:
- items: array of scan log rows
- pagination: paging metadata
- summary: aggregate counts for current filter set
- applied_filters: echo of applied filters

### 5.1 data.items[]

Each row:
- id: number
- action: START | ARRIVE | LEAVE | RETURN
- action_label: STARTED | ARRIVED_PORT | LEFT_PORT | COMPLETED
- location: COMPANY | PORT
- device_id: string | null
- scanned_at: datetime
- created_at: datetime
- operator:
  - id
  - name
  - email
  - role
  - location
- truck:
  - id
  - registration_number
  - driver_name
  - qr_code
- trip:
  - id
  - status
  - is_active

### 5.2 data.pagination

- current_page
- last_page
- per_page
- total
- from
- to

### 5.3 data.summary

- total_logs
- unique_operators
- by_action: object map (key=action, value=count)
- by_location: object map (key=location, value=count)

## 6. UI Requirements for Admin Logs Section

## 6.1 Main Table Columns

Recommended columns:
1. scanned_at
2. action_label
3. location
4. operator.name
5. operator.role
6. truck.registration_number
7. truck.driver_name
8. trip.id
9. trip.status
10. device_id

## 6.2 Filters UI

Recommended controls:
- Date range: from/to
- Action dropdown
- Location dropdown
- Role dropdown
- Operator selector (user_id)
- Registration text filter
- Global search text input

Behavior:
- Any filter change resets page to 1
- Preserve query params in URL for reload/share

## 6.3 Summary Widgets

Use data.summary for cards/charts:
- Total logs
- Unique operators
- Distribution by action
- Distribution by location

## 7. Error Handling

- 401: token missing/invalid/expired -> redirect to login
- 403: user not ADMIN -> show permission error page
- 422: invalid filters -> show field-level validation feedback

## 8. Backward Compatibility

No existing endpoint was removed.

Existing endpoints remain valid:
- GET /api/trips/{trip}/logs
- GET /api/operator/last-scans

New endpoint is additive and admin-only:
- GET /api/scan-logs

## 9. Frontend Integration Checklist

1. Add new Admin Logs menu section.
2. Implement table + pagination driven by GET /api/scan-logs.
3. Implement filter bar using parameter names from section 3.
4. Render summary cards/charts from data.summary.
5. Add role/401/403 handling.
6. Keep URL query string in sync with current filter state.
