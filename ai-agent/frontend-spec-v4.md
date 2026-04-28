# Admin Panel Scan Flow - Frontend Update Specification

## 1. Purpose

This document defines the frontend contract for configuring the scan flow from the admin panel.

Goal:
- Allow admins to customize the ordered scan steps used by the backend.
- Keep scan validation strict, but aligned to the configured flow.

## 2. New Endpoints

### 2.1 GET /api/scan-flow

Access:
- ADMIN role only (Bearer token required)

Returns:
- The active flow definition.

Response data:
- id: number | null
- steps: string[]
- is_active: boolean
- created_at: datetime | null
- updated_at: datetime | null

Example response data:
```json
{
  "id": 1,
  "steps": ["STARTED", "ARRIVED_PORT", "LEFT_PORT", "COMPLETED"],
  "is_active": true,
  "created_at": "2026-04-28T10:00:00Z",
  "updated_at": "2026-04-28T10:00:00Z"
}
```

### 2.2 PUT /api/scan-flow

Access:
- ADMIN role only (Bearer token required)

Request body:
```json
{
  "steps": ["LEFT_PORT", "COMPLETED"]
}
```

Success response data:
- Same shape as GET /api/scan-flow

## 3. Allowed Steps

Steps are limited to the following values:
- STARTED
- ARRIVED_PORT
- LEFT_PORT
- COMPLETED

Role and location enforcement remains unchanged:
- STARTED and COMPLETED require COMPANY_OPERATOR at COMPANY
- ARRIVED_PORT and LEFT_PORT require PORT_OPERATOR at PORT

## 4. Validation Rules

Backend validation for PUT /api/scan-flow:
- steps is required, array, min 1
- each step must be one of the allowed values
- steps must be unique
- last step must be COMPLETED

Validation errors return 422 with field-level messages.

## 5. Behavior Changes

- /api/scan now uses the configured flow to decide the next expected step.
- Any scan that does not match the configured flow is rejected.
- If an active trip has a status not present in the configured flow, the next scan auto-aligns it to the first step in the active flow.
- next_expected_step in trip payloads is computed from the active flow.

## 6. UI Requirements

### 6.1 Flow Editor

Recommended UI controls:
- Ordered list of steps
- Drag and drop reorder
- Remove step
- Add step from allowed list

Constraints to enforce in UI:
- Prevent duplicates
- Enforce COMPLETED as the last step

### 6.2 Suggested Presets

Provide quick presets for common flows:
- Standard: STARTED -> ARRIVED_PORT -> LEFT_PORT -> COMPLETED
- Short: LEFT_PORT -> COMPLETED
- Minimal: STARTED -> COMPLETED

### 6.3 Save Behavior

- On save, call PUT /api/scan-flow with steps in order
- After success, refresh GET /api/scan-flow
- Show warning that changes affect all new scans immediately

## 7. Error Handling

- 401: token missing/invalid/expired -> redirect to login
- 403: user not ADMIN -> show permission error
- 422: invalid steps -> show field-level error
- 409: active trip status not in flow -> show scan rejected message in operator UI

## 8. Backward Compatibility

If no scan flow record exists yet, the backend defaults to:
- STARTED -> ARRIVED_PORT -> LEFT_PORT -> COMPLETED
