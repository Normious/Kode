# Kode — QR Code Generator & Scanner API

Node.js + Fastify + SQLite. Centralized QR generation and scanning.

## Quickstart

```bash
npm install
npm run migrate
npm run seed
npm start
# health: http://localhost:4009/health
```

Or Docker: `docker compose up --build -d`

## Endpoints (all except `/` + `/health` need `X-API-Key`)

- `POST /qr/generate` — `{data, format: png|svg|datauri|json, size?, margin?, error_correction?, foreground?, background?}`
- `POST /qr/generate/preset` — `{preset, payload, format?, ...style}`
- `POST /qr/generate/batch` — `{items: [{data?|preset+payload, format?, ...}]}`
- `POST /qr/scan` — multipart `file`
- `GET /qr/presets`, `GET /qr/history?limit&offset&operation&preset&status&search`, `GET /qr/stats?days`
- `GET /health`, `GET /`

Presets: `url text wifi vcard email sms tel geo upi momo`

## Test locally

```bash
node scripts/test-local.js
```
