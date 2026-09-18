import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resolvedDbPath = path.isAbsolute(config.databasePath)
  ? config.databasePath
  : path.join(__dirname, '..', config.databasePath);

const dataDir = path.dirname(resolvedDbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let db = null;

export function getDatabase() {
  if (!db) {
    db = new Database(resolvedDbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
  }
  return db;
}

function migrate(db) {
  const migrationPath = path.join(__dirname, '../migrations/0001_init.sql');
  if (fs.existsSync(migrationPath)) {
    db.exec(fs.readFileSync(migrationPath, 'utf8'));
  }
}

// ─── Projects ──────────────────────────────────────────────

export function getProjectByApiKey(apiKey) {
  return getDatabase()
    .prepare('SELECT * FROM projects WHERE api_key = ? AND is_active = 1')
    .get(apiKey);
}

// ─── History ───────────────────────────────────────────────

export function logHistory(projectId, entry) {
  const preview = entry.content_preview
    ? String(entry.content_preview).slice(0, 200)
    : null;

  const result = getDatabase()
    .prepare(`
      INSERT INTO qr_history
      (project_id, operation, preset, content_type, content_preview, data_length,
       output_format, output_size_bytes, image_width, image_height, error_correction,
       scan_success, scan_duration_ms, duration_ms, status, error_message,
       client_ip, user_agent, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      projectId,
      entry.operation,
      entry.preset || null,
      entry.content_type || null,
      preview,
      entry.data_length || null,
      entry.output_format || null,
      entry.output_size_bytes || null,
      entry.image_width || null,
      entry.image_height || null,
      entry.error_correction || null,
      entry.scan_success !== undefined ? (entry.scan_success ? 1 : 0) : null,
      entry.scan_duration_ms || null,
      entry.duration_ms || null,
      entry.status,
      entry.error_message || null,
      entry.client_ip || null,
      entry.user_agent || null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      Date.now()
    );

  const date = new Date().toISOString().slice(0, 10);
  const generated = entry.operation !== 'scan' && entry.status === 'success' ? 1 : 0;
  const scanned = entry.operation === 'scan' && entry.status === 'success' ? 1 : 0;
  const failed = entry.status === 'failed' ? 1 : 0;

  getDatabase()
    .prepare(`
      INSERT INTO daily_summary
      (project_id, date, generated_count, scanned_count, failed_count, total_output_bytes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, date) DO UPDATE SET
        generated_count = generated_count + excluded.generated_count,
        scanned_count = scanned_count + excluded.scanned_count,
        failed_count = failed_count + excluded.failed_count,
        total_output_bytes = total_output_bytes + excluded.total_output_bytes,
        updated_at = excluded.updated_at
    `)
    .run(
      projectId,
      date,
      generated,
      scanned,
      failed,
      entry.output_size_bytes || 0,
      Date.now()
    );

  return result.lastInsertRowid;
}

export function listHistory(projectId, filters) {
  const conditions = ['project_id = ?'];
  const params = [projectId];

  if (filters.operation) {
    conditions.push('operation = ?');
    params.push(filters.operation);
  }
  if (filters.preset) {
    conditions.push('preset = ?');
    params.push(filters.preset);
  }
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.from_date) {
    conditions.push('created_at >= ?');
    params.push(filters.from_date);
  }
  if (filters.to_date) {
    conditions.push('created_at <= ?');
    params.push(filters.to_date);
  }
  if (filters.search) {
    conditions.push('content_preview LIKE ?');
    params.push(`%${filters.search}%`);
  }

  const where = conditions.join(' AND ');

  const total = getDatabase()
    .prepare(`SELECT COUNT(*) as c FROM qr_history WHERE ${where}`)
    .get(...params).c;

  const rows = getDatabase()
    .prepare(`SELECT * FROM qr_history WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, filters.limit, filters.offset);

  return { entries: rows, total };
}

export function getStats(projectId, days = 30) {
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const rows = getDatabase()
    .prepare(`
      SELECT date, generated_count, scanned_count, failed_count, total_output_bytes
      FROM daily_summary
      WHERE project_id = ? AND date >= ?
      ORDER BY date ASC
    `)
    .all(projectId, fromDate);

  const byPreset = getDatabase()
    .prepare(`
      SELECT preset, COUNT(*) as c FROM qr_history
      WHERE project_id = ? AND preset IS NOT NULL AND status = 'success'
      GROUP BY preset ORDER BY c DESC
    `)
    .all(projectId);

  const totalGenerated = rows.reduce((s, r) => s + r.generated_count, 0);
  const totalScanned = rows.reduce((s, r) => s + r.scanned_count, 0);
  const totalFailed = rows.reduce((s, r) => s + r.failed_count, 0);
  const totalBytes = rows.reduce((s, r) => s + r.total_output_bytes, 0);

  const presetMap = {};
  for (const r of byPreset) presetMap[r.preset] = r.c;

  return {
    days,
    daily: rows,
    totals: {
      generated: totalGenerated,
      scanned: totalScanned,
      failed: totalFailed,
      total_output_bytes: totalBytes,
    },
    by_preset: presetMap,
  };
}
