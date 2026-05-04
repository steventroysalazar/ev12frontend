# API Calls from Login to Last Call (Grouped by Use)

This document maps the frontend API calls that are used in the login/authenticated flow and adjacent operational views.

## users
- `POST /api/auth/register` — Registers a new user account from the auth screen. (`handleRegister`)
- `POST /api/auth/login` — Authenticates user credentials and starts a session. (`handleLogin`)
- `POST /api/auth/logout` — Ends the authenticated session and records logout device metadata. (`handleLogout`)
- `GET /api/users` — Loads users for admin/home management tables and lookups.
- `POST /api/users` — Creates a user (admin workflow fallback path).
- `PUT /api/users/:editingUserId` — Updates a user record (primary update strategy).
- `PATCH /api/users/:editingUserId` — Updates a user record (fallback update strategy).
- `POST /api/users/:userId/devices` — Creates a new device under a specific user.

## logs
- `GET /api/auth/logs` — Retrieves authentication logs, with optional query suffix/filters.
- `GET /api/error-logs?limit=150` — Retrieves recent error logs.
- `GET /api/devices/:deviceId/alarm-logs` — Retrieves per-device alarm logs.
- `GET /api/devices/:deviceId/location-breadcrumbs` — Retrieves historical location breadcrumb trail.

## alerts
- `GET /api/lookups/alerts` — Retrieves alert code lookup metadata used for filtering and labels.
- `GET /api/lookups/alert-logs` — Retrieves alert-log filter metadata (alarmCodes, actions, sources).
- `GET /api/devices/:deviceId/alarm-logs` — Retrieves device alert/alarm log entries used across the alerts dashboard.
- `GET /api/webhooks/ev12/events` — Loads alert-style inbound webhook events used by live monitoring and map fallback logic.

## webhooks
- `GET /api/webhooks/ev12/events` — Fetches webhook events for the webhooks panel and event replay.
- `GET https://ev12-backend-dev.mangoisland-fc3c6273.australiaeast.azurecontainerapps.io/api/webhooks/ev12/events` — Hosted-backend fallback for webhook reads when proxy/local route is unavailable.
- `DELETE /api/webhooks/ev12/events` — Clears webhook event history from the API.
- `DELETE https://ev12-backend-dev.mangoisland-fc3c6273.australiaeast.azurecontainerapps.io/api/webhooks/ev12/events` — Hosted-backend fallback for clearing webhook history.

## sms configuration + gateway settings
- `POST /api/messages/send` — Sends test SMS from the gateway panel and is also used as a fallback command transport.
- `GET /api/messages/replies?phone=&limit=` — Loads inbound SMS replies from the primary replies endpoint.
- `GET /api/inbound-messages?phone=&limit=` — Fallback endpoint for inbound replies when primary replies endpoint is unavailable.
- `POST /api/send-config` — Sends EV12 SMS configuration payload (preferred config endpoint).
- `POST /api/config/send` — Alternate SMS configuration endpoint (fallback).
- Request headers used with authenticated gateway actions:
  - `X-Gateway-Base-Url` — Uses the UI “Gateway Base URL” value when provided.
  - `Authorization` — Uses the UI “Gateway Token” value for gateway-authenticated calls.

## sim activation + lifecycle
- `POST /api/devices/:deviceId/sim/activate` — Activates SIM service for a device from the device management workflow.
- `POST /api/devices/:deviceId/sim/deactivate` — Deactivates SIM service for a device when service should be suspended.

## devices
- `GET /api/devices` — Lists devices.
- `GET /api/devices/:id` — Retrieves full details for a specific device.
- `POST /api/devices` — Creates a device (non-user-scoped fallback path).
- `PUT /api/devices/:editingDeviceId` — Updates a device (primary update strategy).
- `PATCH /api/devices/:editingDeviceId` — Updates a device (fallback update strategy).
- `POST /api/devices/:deviceId/imei-resend` — Re-sends IMEI/config payload for a device.
- `POST /api/devices/:deviceId/sim/activate` — Activates SIM service on a device.
- `POST /api/devices/:deviceId/sim/deactivate` — Deactivates SIM service on a device.
- `GET /api/devices/:resolvedId/config-status` — Checks command/config delivery status.
- `POST /api/devices/:resolvedId/config-resend` — Re-sends config command to device.

## related support endpoints used in same flow
- `GET /api/companies`, `POST /api/companies`, `PUT /api/companies/:id`, `PUT /api/companies/:id/alarm-receiver`
- `GET /api/locations`, `POST /api/locations`, `PUT/PATCH /api/locations/:id`, `PUT /api/locations/:id/alarm-receiver`
- `GET /api/lookups/*` (company-admins, portal-users, mobile-users, super-admins, companies, locations, alerts, alert-logs)
