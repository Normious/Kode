# Deep Dive: Data Layer (`src/db.js`, `migrations/`, `seed.js`)

## Schema (`migrations/0001_init.sql`, 75 lines)

```mermaid
erDiagram
  projects ||--o{ qr_history : "has"
  projects ||--o{ daily_summary : "rolls up into"
  projects {
    int id PK
    text name
    text api_key UK
    int default_size
    int default_margin
    text default_error_correction
    text default_foreground
    text default_background
    int is_active
    int created_at
    int updated_at
  }
  qr_history {
    int id PK
    int project_id FK
    text operation
    text preset
    text content_type
    text content_preview
    int data_length
    text output_format
    int output_size_bytes
    int image_width
    int image_height
    text error_correction
    int scan_success
    int scan_duration_ms
    int duration_ms
    text status
    text error_message
    text client_ip
    text user_agent
    text metadata
    int created_at
  }
  daily_summary {
    int id PK
    int project_id FK
    text date UK
    int generated_count
    int scanned_count
    int failed_count
    int total_output_bytes
  }
```

Indexes on `api_key`, `(project_id)`, `(project_id, operation)`,
`(project_id, preset)`, `created_at`, and `(project_id, date)`: every hot
query path is covered. `UNIQUE(project_id, date)` makes the rollup upsert-safe.

## `db.js` (196 lines)

- `getDatabase()`: lazy singleton, creates parent dir, `journal_mode=WAL`,
  `foreign_keys=ON`, runs the migration file idempotently (`IF NOT EXISTS`
  everywhere, so boot is safe to repeat).
- `getProjectByApiKey`: single indexed lookup gated on `is_active`.
- `logHistory`: truncates preview to 200 chars, inserts the journal row, then
  upserts today's rollup (`generated` = non-scan success, `scanned` = scan
  success, `failed` = any failure). Auditing never throws past the caller:
  route handlers call it synchronously inside try/catch flows.
- `listHistory`: dynamic `WHERE` from optional filters + `LIKE` search, with
  separate `COUNT(*)` for pagination.
- `getStats`: last-N-days rollup rows + totals + live `by_preset` aggregation
  over successful preset rows.

## Seeds (`seed.js`, 30 lines)

Idempotent `INSERT OR IGNORE`: **Dobadoba** (`dobadoba-qr-key-2026`, 400 px/`M`)
and **Gig4Gig** (`gig4gig-qr-key-2026`, 500 px/`H`). Re-runnable safely.

## Notes

- Timestamps are epoch millis (`Date.now()`); day buckets are UTC `YYYY-MM-DD`.
- `metadata` is free-form JSON (stringified) for caller correlation IDs etc.
- DB path resolves relative to project root (`DATABASE_PATH`, default
  `./data/kode.db`; `/app/data/kode.db` in Docker via named volume).
