-- ─────────────────────────────────────────────
-- 1. Projects (Tenants)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    default_size INTEGER DEFAULT 400,
    default_margin INTEGER DEFAULT 2,
    default_error_correction TEXT DEFAULT 'M',
    default_foreground TEXT DEFAULT '#000000',
    default_background TEXT DEFAULT '#FFFFFF',
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_api_key ON projects(api_key);

-- ─────────────────────────────────────────────
-- 2. Generation History
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qr_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    operation TEXT NOT NULL,
    preset TEXT,
    content_type TEXT,
    content_preview TEXT,
    data_length INTEGER,

    output_format TEXT,
    output_size_bytes INTEGER,
    image_width INTEGER,
    image_height INTEGER,
    error_correction TEXT,

    scan_success INTEGER,
    scan_duration_ms INTEGER,

    duration_ms INTEGER,
    status TEXT NOT NULL,
    error_message TEXT,
    client_ip TEXT,
    user_agent TEXT,

    metadata TEXT,
    created_at INTEGER NOT NULL,

    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_history_project ON qr_history(project_id);
CREATE INDEX IF NOT EXISTS idx_history_operation ON qr_history(project_id, operation);
CREATE INDEX IF NOT EXISTS idx_history_preset ON qr_history(project_id, preset);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON qr_history(created_at);

-- ─────────────────────────────────────────────
-- 3. Daily Usage Summary
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    generated_count INTEGER DEFAULT 0,
    scanned_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    total_output_bytes INTEGER DEFAULT 0,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, date)
);

CREATE INDEX IF NOT EXISTS idx_summary_project ON daily_summary(project_id);
CREATE INDEX IF NOT EXISTS idx_summary_date ON daily_summary(date);
