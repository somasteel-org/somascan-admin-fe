# Camion Temps Admin FE - Current Project Status

## 1) Project Overview

- Name: camion-temps-admin-fe
- Stack: React 19 + TypeScript + Vite
- State management: Zustand (authentication state)
- Routing: react-router-dom (protected admin routes)
- HTTP client: Axios with request and response interceptors
- Data visualization: Recharts
- QR and PDF: qrcode + jsPDF
- API base URL: http://localhost:8000/api

## 2) Current Functional Status

The admin frontend is operational for the main business flows:

- Authentication and admin-only session control are implemented.
- Dashboard KPIs and charts are implemented.
- Truck management (CRUD + activation + QR generation + PDF download) is implemented.
- User/operator management (CRUD + filters + pagination) is implemented.
- Trip tracking list with filters and pagination is implemented.
- Trip detail view with timeline, computed durations, and logs is implemented.
- Reports page with delays analysis and export is implemented.

## 3) Feature Inventory and Logic Behind

### Authentication and Access Control

- Login page calls POST /login, extracts token and user from multiple possible response shapes.
- Only users with role ADMIN are accepted in the admin app.
- Auth token and user are persisted in localStorage.
- Protected route validates current session via GET /me.
- If role is not ADMIN or response is 401/403, local session is cleared and user is redirected to /login.
- Axios request interceptor automatically adds Authorization header (supports already-prefixed tokens and raw tokens).
- Axios response interceptor handles 401 globally by clearing local auth and forcing redirect to /login.

### Routing and Navigation

- Public route: /login
- Protected routes under admin layout:
  - /dashboard
  - /trucks
  - /users
  - /trips
  - /trips/:id
  - /reports
- Root path / redirects to /dashboard.
- Unknown paths go to not-found page.

### Dashboard

- Loads in parallel:
  - reports summary
  - trip evolution
  - duration distribution
- KPI cards show:
  - total trips
  - active trips
  - average company-to-port duration
  - average port duration
  - average port-to-company duration
- Charts:
  - line chart for daily trip evolution
  - bar chart for duration distribution
- Uses ResizeObserver to render charts only when container width is available.

### Trucks Management

- Features:
  - list with status filter (all/active/inactive)
  - pagination
  - create truck
  - edit truck
  - activate/deactivate truck
  - delete truck
  - generate QR for truck
  - view existing QR
  - download QR as PDF
- Logic details:
  - registration number is trimmed before submit
  - errors are normalized with shared API error parser
  - QR preview is generated as Data URL from returned qr_code value
  - PDF includes registration, QR raw value, and QR image

### Users Management

- Features:
  - list users with filters by role and location
  - pagination
  - create user
  - edit user
  - delete user
- Logic details:
  - create requires password length >= 8
  - update keeps password optional
  - role and location are explicitly controlled
  - API error responses are normalized and displayed

### Trips Tracking

- Features:
  - list trips
  - filter by status
  - filter by date range (from/to)
  - filter by truck id
  - pagination
  - open trip detail page
- Logic details:
  - all filters trigger reload and reset page where relevant
  - trip list displays key timeline points and current status

### Trip Detail

- Features:
  - fetches trip core data and trip logs in parallel
  - displays full timeline
  - computes three durations:
    - company to port
    - port stay duration
    - port to company
  - displays scanner/operator logs in table

### Reports

- Features:
  - fetch delay data
  - chart delays by truck
  - table of delay details
  - export report payload
- Logic details:
  - export currently downloads JSON payload as a file
  - button label says CSV / Excel, but implementation generates JSON file named rapport-trajets.json

## 4) Existing API Surface Used by Frontend

### Auth API

- POST /login
- POST /logout
- GET /me

### Users API

- GET /users
- POST /users
- PATCH /users/:id
- DELETE /users/:id

### Trucks API

- GET /trucks
- POST /trucks
- PATCH /trucks/:id
- DELETE /trucks/:id
- PATCH /trucks/:id/activate
- PATCH /trucks/:id/deactivate
- POST /trucks/:id/generate-qr

### Trips API

- GET /trips
- GET /trips/active
- GET /trips/history
- GET /trips/:id
- GET /trips/:id/logs

### Reports API

- GET /reports/summary
- GET /reports/durations
- GET /reports/delays
- GET /reports/truck/:truckId
- GET /reports/export

## 5) Data Parsing and Resilience Logic

- API modules are defensive against different backend response shapes:
  - supports direct array payloads
  - supports nested data wrappers
  - supports alternate list keys (items, users, trucks, trips)
- Pagination parser normalizes page, perPage, total, and lastPage.
- Error parser maps common HTTP statuses and validation error structures to user-friendly messages.
- Auth parsing supports multiple token and user field names.

## 6) Notable Implementation Notes

- The app is configured for admin-only usage even if API returns other roles.
- Session hydration is performed on app startup and on login page mount.
- Unauthorized API responses force immediate redirect to /login.
- Reports evolution is currently computed client-side from completed trips, not fetched from a dedicated evolution endpoint.

## 7) Gaps and Inconsistencies to Be Aware Of

- Reports export UI text indicates CSV / Excel, while actual export is JSON.
- README is still the default Vite template and does not document project-specific setup/features.
- API base URL is hardcoded in constants; no environment-based configuration is present.

## 8) Quick Status Summary

- Core admin features: implemented
- API integration coverage: broad and production-oriented for current scope
- Main technical risk areas: export format mismatch, missing project README details, hardcoded API base URL
