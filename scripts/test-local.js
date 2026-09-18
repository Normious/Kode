/* Systematic local test for Kode — covers every endpoint in spec §10 */
const BASE = process.env.KODE_URL || 'http://localhost:4009';
const KEY = process.env.KODE_KEY || 'dobadoba-qr-key-2026';
const H = { 'X-API-Key': KEY, 'Content-Type': 'application/json' };

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`PASS ${name} ${extra}`); }
  else { fail++; console.log(`FAIL ${name} ${extra}`); }
};

const post = async (path, body, headers = H) => {
  const r = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: r.status, buf: Buffer.from(await r.arrayBuffer()), json: async () => JSON.parse(r.headers.get('content-type')?.includes('json') ? Buffer.from(await r.arrayBuffer()).toString() : '{}') };
};

// helper that returns status + smart body
async function callJSON(path, body, key = KEY) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const ct = r.headers.get('content-type') || '';
  const buf = Buffer.from(await r.arrayBuffer());
  let json = null;
  if (ct.includes('json')) { try { json = JSON.parse(buf.toString()); } catch {} }
  return { status: r.status, buf, json, ct };
}

async function callGET(path, key = KEY) {
  const r = await fetch(`${BASE}${path}`, { headers: { 'X-API-Key': key } });
  const json = await r.json().catch(() => null);
  return { status: r.status, json };
}

// 1. health + root (no auth)
{
  const h = await fetch(`${BASE}/health`).then((r) => r.json());
  ok('health', h.status === 'ok', JSON.stringify(h).slice(0, 80));
  const root = await fetch(`${BASE}/`).then((r) => r.json());
  ok('root', root.service === 'Kode' && root.presets?.length === 10, `presets=${root.presets?.length}`);
}

// 2. auth failures
{
  const r1 = await fetch(`${BASE}/qr/presets`);
  ok('auth-missing-401', r1.status === 401);
  const r2 = await callGET('/qr/presets', 'bad-key');
  ok('auth-invalid-401', r2.status === 401);
}

// 3. presets list
{
  const { status, json } = await callGET('/qr/presets');
  ok('presets-list', status === 200 && json.count === 10, `count=${json?.count}`);
}

// 4. generate png / svg / datauri / json
let pngBuffer;
{
  const png = await callJSON('/qr/generate', { data: 'https://dobadoba.com/pay/TXN-12345', size: 400, format: 'png' });
  ok('gen-png', png.status === 200 && png.buf.slice(1, 4).toString() === 'PNG', `bytes=${png.buf.length}`);
  pngBuffer = png.buf;
  const fs = await import('fs');
  fs.writeFileSync('payment-qr.png', pngBuffer);

  const svg = await callJSON('/qr/generate', { data: 'https://shop-a.com/products/42', format: 'svg', size: 300 });
  ok('gen-svg', svg.status === 200 && svg.buf.toString().includes('<svg'), `bytes=${svg.buf.length}`);

  const du = await callJSON('/qr/generate', { data: 'Hello, world!', format: 'datauri' });
  ok('gen-datauri', du.status === 200 && du.json?.data_uri?.startsWith('data:image/png'), `bytes=${du.json?.size_bytes}`);

  const js = await callJSON('/qr/generate', { data: 'Hello JSON', format: 'json' });
  ok('gen-json', js.status === 200 && js.json?.base64?.length > 100, `bytes=${js.json?.size_bytes}`);

  const bad = await callJSON('/qr/generate', { data: '', format: 'png' });
  ok('gen-empty-400', bad.status === 400);
}

// 5. presets: wifi / vcard / momo / url
{
  const w = await callJSON('/qr/generate/preset', { preset: 'wifi', payload: { ssid: 'Dobadoba-Guest', password: 'welcome2026', encryption: 'WPA' } });
  ok('preset-wifi', w.status === 200);

  const v = await callJSON('/qr/generate/preset', {
    preset: 'vcard',
    payload: { first_name: 'Alice', last_name: 'Banda', organization: 'Dobadoba', title: 'CTO', phone: '+265888111222', email: 'alice@dobadoba.com', website: 'https://dobadoba.com' },
    format: 'datauri', size: 500,
  });
  ok('preset-vcard', v.status === 200 && v.json?.success === true);

  const m = await callJSON('/qr/generate/preset', {
    preset: 'momo',
    payload: { phone: '+265888123456', provider: 'airtel', amount: 15000, currency: 'MWK', reference: 'INV-2026-001' },
    format: 'datauri',
  });
  ok('preset-momo', m.status === 200);

  const u = await callJSON('/qr/generate/preset', { preset: 'url', payload: { url: 'dobadoba.com/order/1' }, format: 'datauri' });
  ok('preset-url', u.status === 200);

  const bad = await callJSON('/qr/generate/preset', { preset: 'nope', payload: {} });
  ok('preset-unknown-400', bad.status === 400);
}

// 6. batch
{
  const b = await callJSON('/qr/generate/batch', {
    items: [
      { preset: 'url', payload: { url: 'https://dobadoba.com/order/1' }, format: 'datauri' },
      { preset: 'url', payload: { url: 'https://dobadoba.com/order/2' }, format: 'datauri' },
      { preset: 'tel', payload: { phone: '+265888111222' }, format: 'datauri' },
    ],
  });
  ok('batch-3', b.status === 200 && b.json?.succeeded === 3, `succeeded=${b.json?.succeeded}`);
}

// 7. scan round-trip (generate -> scan)
{
  const fd = new FormData();
  fd.append('file', new Blob([pngBuffer], { type: 'image/png' }), 'payment-qr.png');
  const r = await fetch(`${BASE}/qr/scan`, { method: 'POST', headers: { 'X-API-Key': KEY }, body: fd });
  const j = await r.json();
  ok('scan-roundtrip', r.status === 200 && j.data === 'https://dobadoba.com/pay/TXN-12345', `data=${j.data}`);
}

// 8. history + stats
{
  const h = await callGET('/qr/history?limit=5');
  ok('history', h.status === 200 && h.json?.pagination?.total > 0, `total=${h.json?.pagination?.total}`);
  const s = await callGET('/qr/stats?days=30');
  ok('stats', s.status === 200 && s.json?.totals?.generated > 0, JSON.stringify(s.json?.totals));
}

console.log(`\nDone: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
