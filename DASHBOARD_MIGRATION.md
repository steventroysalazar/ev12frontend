# Dashboard Migration Guide (EV12 Frontend)

## What the dashboard does
- Serves as the main operations console after login (`HomeView`) with role-aware visibility and navigation.
- Shows KPI cards for companies, users, devices, locations, and error logs.
- Surfaces active device alarm state and connectivity logs, including webhook event history persisted in local storage.
- Provides device-centric drilldowns (device details/settings) and entity management pages (companies/users/locations/devices).
- Supports operational actions such as SIM activation/deactivation, IMEI resend, device creation/editing, and alarm-receiver/location/company updates.

## Dashboard wireframe (structure only, not visual style)
- **Shell/layout**: two-column app shell (left sidebar + right content pane).
- **Primary sections**: dashboard, companies, users, user detail, locations, location detail, devices, bulk SIM, device-detail tabs, settings tabs, logs, commands/replies, webhooks.
- **Top summary row**: KPI blocks for total companies, users, devices, locations, and error logs.
- **Operational workspace**: device list with search, alert-status filters, and pagination.
- **Monitoring blocks**: alarm + connectivity timeline summaries.
- **Webhook block**: fetch/clear event stream, fingerprint-based new-event detection, local persistence (`ev12:webhook-events`).
- **Map block**: focused active-alarm location support.

## Data/API calls required by dashboard and adjacent sections
Core list data:
- `GET /api/users`
- `GET /api/companies`
- `GET /api/locations`
- `GET /api/devices` (fallback: flatten users[].devices from `/api/users`)

Lookups:
- `GET /api/lookups/company-admins`
- `GET /api/lookups/portal-users`
- `GET /api/lookups/mobile-users`
- `GET /api/lookups/super-admins`
- `GET /api/lookups/companies`
- `GET /api/lookups/locations`
- `GET /api/lookups/alerts`
- `GET /api/lookups/alert-logs`

Logs + timeline:
- `GET /api/devices/:deviceId/alarm-logs`
- `GET /api/error-logs?limit=150`
- `GET /api/auth/logs` (optionally user-scoped via query)
- `GET /api/devices/:deviceId/location-breadcrumbs`

Webhooks:
- `GET /api/webhooks/ev12/events?limit=:limit`
- `DELETE /api/webhooks/ev12/events`
- Fallback backend host is attempted if primary fails.

Device operations:
- `GET /api/devices/:deviceId`
- `POST /api/devices/:deviceId/imei-resend`
- `POST /api/devices/:deviceId/sim/activate`
- `POST /api/devices/:deviceId/sim/deactivate`
- `POST /api/devices` or `POST /api/users/:userId/devices` (creation path varies)
- `PUT/PATCH /api/devices/:deviceId`

Entity management:
- `POST /api/locations`, `PUT/PATCH /api/locations/:locationId`
- `PUT /api/locations/:locationId/alarm-receiver`
- `POST /api/companies`, `PUT /api/companies/:companyId`
- `PUT /api/companies/:companyId/alarm-receiver`
- `POST /api/users` or `POST /api/auth/register`, `PUT/PATCH /api/users/:userId`

## Engineering architecture notes (important for migration)
- Single orchestration component (`HomeView.jsx`) owns most state and effects.
- Section routing is query-param based (`?page=...&id=...`) not React Router nested routes.
- Data adapters normalize heterogeneous API payload shapes (`asCollection`, key aliases).
- Fetch layer uses fallback-capable wrappers (`fetchJsonWithFallback`, `fetchWithFallback`).
- Role gating logic (super admin/company admin/scoped user) drives list visibility and counts.
- Lazy-loaded page modules reduce initial payload for non-dashboard sections.

## Copy-ready prompt for recreating wireframe + engineering (no design copying)
Use this prompt with your target AI/codegen tool:

"Build a production-grade React admin dashboard that recreates the EV12 dashboard's INFORMATION ARCHITECTURE and ENGINEERING behavior only. Do NOT copy branding, color palette, gradients, shadows, icon set, typography, or other visual identity.

Requirements:
1) Wireframe/Layout (neutral styling)
- Implement a two-column shell: left navigation + right main content.
- Create a dashboard page with:
  - KPI summary row (companies, users, devices, locations, error logs)
  - Device operations panel (search + filters + pagination)
  - Monitoring panels (alarm/connectivity summaries)
  - Webhook events panel
  - Map/location focus panel
- Use simple placeholder styling (neutral grayscale, basic spacing, standard cards).

2) Navigation/Sections
- Query-param driven section routing with `?page=<section>&id=<entityId>`.
- Support sections: dashboard, companies, users, user-detail, locations, location-detail, devices, bulk-sim, device-detail-overview/basic/advanced/location/commands, settings-basic/settings-advanced, alarm-logs, auth-logs, error-logs, commands, replies, webhooks.

3) Data/API contract
Implement service methods for:
- GET `/api/users`, `/api/companies`, `/api/locations`, `/api/devices`
- GET `/api/lookups/company-admins|portal-users|mobile-users|super-admins|companies|locations|alerts|alert-logs`
- GET `/api/devices/:id/alarm-logs`, `/api/error-logs?limit=150`, `/api/auth/logs`, `/api/devices/:id/location-breadcrumbs`
- GET + DELETE `/api/webhooks/ev12/events` (with optional `?limit=`)
- Device ops: GET `/api/devices/:id`, POST `/api/devices/:id/imei-resend`, POST `/api/devices/:id/sim/activate`, POST `/api/devices/:id/sim/deactivate`, POST/PUT/PATCH device CRUD
- Entity ops for users/locations/companies including alarm-receiver endpoints.

4) Behavior
- Role-scoped visibility for list data and counts.
- Alarm log aggregation across devices, including connectivity classification.
- Webhook event persistence in localStorage and new-event fingerprint detection.
- Device search + alert-status filtering + pagination (page size 8).
- Graceful fallback if one endpoint shape differs (normalize aliases and arrays).

5) Architecture constraints
- Use lazy loading for non-primary sections.
- Keep one orchestrator container component for shared state and effects.
- Implement a fetch utility that supports fallback base URLs and unified error handling.
- Provide TypeScript-friendly models/interfaces for users/devices/locations/companies/logs/webhooks.

Deliverables:
- React components with neutral wireframe styling only
- API service layer
- State management and hooks
- Seed/mock data option for local development
- Short README documenting endpoint contracts, section map, and role-scope rules."
