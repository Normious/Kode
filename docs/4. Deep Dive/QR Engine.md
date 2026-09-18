# Deep Dive: QR Engine (`src/qr/`)

Stateless encode/decode core. No HTTP, no database: only `config.js` limits
and defaults flow in.

## `generator.js` (134 lines)

Merges options with project-then-global precedence:
explicit opt → `project.default_*` → `config.defaults`. EC level validated
against `L/M/Q/H`; per-level byte-length caps enforced (`L:4296 M:3391 Q:2420
H:1852`) plus the global `MAX_DATA_LENGTH`.

- `generatePNG` → `QRCode.toBuffer` → `{buffer, size_bytes, width, height,
  error_correction}`. Single source of truth: `json` format reuses it + base64.
- `generateSVG` → `QRCode.toString(..., svg)`; ~10× smaller than PNG for
  vector/print use.
- `generateDataURI` → `QRCode.toDataURL`; returns both `dataUri` (embed-ready)
  and raw `base64`.
- `generateWithLogo`: renders at ≥800 px with forced `H`, composites a
  centered 22%-width logo via Sharp, downscales to target size. High-res
  render keeps modules crisp under the logo.

## `scanner.js` (75 lines)

1. `sharp(buffer).metadata()` → dimension cap (`MAX_IMAGE_DIMENSION`, bomb
   protection).
2. Decode to raw RGBA (`ensureAlpha().raw()`), run `jsqr` with `dontInvert`.
3. If missed and `SCAN_TRY_HARDER`: retry `attemptBoth` (catches inverted codes).
4. If still missed and smallest side <500 px: nearest-neighbor upscale ×2 and
   retry (catches tiny codes).
5. Returns `{success, data?, image{width,height,format}, location{corners},
   duration_ms}`: never throws on "no QR", only on unreadable input.

## `presets.js` (135 lines)

Ten builders returning `{content, content_type, description}`:

| Preset | Builds | Required |
| :--- | :--- | :--- |
| `url` | auto-prefixes `https://` | `url` |
| `text` | raw string | `text` |
| `wifi` | `WIFI:T:...;S:...;P:...;` (escapes `\;,: "`) | `ssid` |
| `vcard` | vCard 3.0 block | name or `organization` |
| `email` | `mailto:` + encoded subject/body | `to` |
| `sms` | `SMSTO:to:body` | `to` |
| `tel` | `tel:phone` | `phone` |
| `geo` | `geo:lat,lon?q=` | `lat`, `lon` |
| `upi` | `upi://pay?pa=&pn=&am=...` | `vpa`, `name` |
| `momo` | `momo://pay?provider=&phone=&amount=...` | `phone` |

`listPresets()` exposes names + field schemas (powers `GET /qr/presets`);
`buildPreset` throws on unknown names: the route converts that to 400.

## Testing

Covered by `scripts/test-local.js` (all 10 presets round-tripped) plus the
15-check edge suite; logo path verified by direct invocation
(12 KB output, `has_logo`, EC `H`). No framework: plain Node asserts.
