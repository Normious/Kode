# Deep Dive: Configuration & Server Boot

## `config.js` (34 lines)

Loads `../.env` via dotenv; **every key has a working default**, so the service
boots with zero config. Groups:

- **Server**: `PORT` 4009, `NODE_ENV`, `LOG_LEVEL`.
- **Database**: `DATABASE_PATH` (`./data/kode.db`).
- **Defaults**: `DEFAULT_SIZE` 400, `DEFAULT_MARGIN` 2,
  `DEFAULT_ERROR_CORRECTION` `M`, foreground/background.
- **Limits**: `MAX_DATA_LENGTH` 4296, `MAX_BATCH_SIZE` 50,
  `MAX_IMAGE_SIZE_BYTES` 10 MB, `MAX_IMAGE_DIMENSION` 4096.
- **Scan**: `SCAN_TRY_HARDER` (default true).

`db.js` resolves relative DB paths against the project root so CWD can't break
it; `server.js` sizes the body limit from the image cap.

## Boot sequence (`server.js` → `migrate.js`/`seed.js`)

1. Fastify instance (pino logger, pretty only off-production, with fallback).
2. CORS → Helmet (no CSP) → multipart (1 file, size-capped).
3. `getDatabase()`: mkdir, WAL/FK, idempotent migrations.
4. Authed route group + public `/health`, `/`.
5. Listen `0.0.0.0:PORT`.

`npm run migrate` and `npm run seed` are one-shot scripts reusing the same
initialization: migrate is a no-op-safe boot check, seed is insert-or-ignore.

## Environment matrix

| Var | Default | Docker Compose |
| :--- | :--- | :--- |
| `PORT` | 4009 | 4009 |
| `NODE_ENV` | development | production |
| `DATABASE_PATH` | `./data/kode.db` | `/app/data/kode.db` (volume) |
| Rest | spec §5 values | image defaults (no `.env` shipped: see `.dockerignore`) |
