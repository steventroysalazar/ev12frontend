## SMS access setup formatter

Use `buildEviewSmsAccessSetup(input)` to normalize authorized phone numbers and build a deterministic SMS queue.

```ts
import { buildEviewSmsAccessSetup } from './src/features/home/smsAccessSetup'

const output = buildEviewSmsAccessSetup({
  authorizedNumbers: ['+447111111111', '+447222222222', '', null],
  restrictedAccess: true
})
```

### Example output

```json
{
  "config": {
    "authorizedNumbers": [
      { "slot": 1, "number": "+447111111111", "smsEnabled": 1, "callEnabled": 0, "sms": "A1,1,0,+447111111111" },
      { "slot": 2, "number": "+447222222222", "smsEnabled": 1, "callEnabled": 0, "sms": "A2,1,0,+447222222222" }
    ],
    "restrictedAccess": true,
    "accessModeSms": "callin(1)"
  },
  "smsQueue": [
    "A1,1,0,+447111111111",
    "A2,1,0,+447222222222",
    "callin(1)"
  ]
}
```

### Edge-case notes

- Supports up to 10 slots (`A1`..`A10`) and validates if input exceeds 10.
- Blank/null entries are skipped, but slot indexing remains based on entered positions.
- Phone values are normalized to compact international format (`+<digits>`) and rejected if malformed.
- If `restrictedAccess=true` and no valid numbers remain after normalization, validation fails with a user-facing error.
- `callin(0|1)` is always queued last, after all `A` slot commands.

## Web auth device + audit trail flow

For web clients, we now send device metadata with login/logout so backend audit logs can track PC sessions.

### Login

- Call `POST /api/auth/login` with:
  - `email` (or `username`)
  - `password`
  - `grant_type: "password"`
  - `scope: "type:1"`
  - `os_type` (resolved from browser user agent/platform)
  - `os_version` (best-effort platform value)
  - `api_version: "Web Browser"`
  - `device_id` (stable value persisted in localStorage per browser install)

### Logout

- Call `POST /api/auth/logout` with:
  - `userId`
  - same `device_id`
  - `os_type`
  - `api_version`

### Audit trail

- Backend writes successful login/logout events into `login_logs`.
- Frontend can render audit history from:
  - `GET /api/auth/logs`
  - alias: `GET /api/auth/login-logs`
  - optional filter: `?userId=<id>`
