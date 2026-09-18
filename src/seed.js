import { getDatabase } from './db.js';

const db = getDatabase();
const now = Date.now();

db.prepare(`
  INSERT OR IGNORE INTO projects
  (name, api_key, default_size, default_margin, default_error_correction,
   default_foreground, default_background, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'Dobadoba',
  'dobadoba-qr-key-2026',
  400, 2, 'M', '#000000', '#FFFFFF',
  now, now
);

db.prepare(`
  INSERT OR IGNORE INTO projects
  (name, api_key, default_size, default_margin, default_error_correction,
   default_foreground, default_background, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'Gig4Gig',
  'gig4gig-qr-key-2026',
  500, 2, 'H', '#1a1a1a', '#FFFFFF',
  now, now
);

console.log('Seed data inserted');
