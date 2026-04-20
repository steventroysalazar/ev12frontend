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
      { "slot": 1, "number": "+447111111111", "sms": "A1,+447111111111" },
      { "slot": 2, "number": "+447222222222", "sms": "A2,+447222222222" }
    ],
    "restrictedAccess": true,
    "accessModeSms": "callin(1)"
  },
  "smsQueue": [
    "A1,+447111111111",
    "A2,+447222222222",
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
