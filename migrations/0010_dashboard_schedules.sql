-- 0010_dashboard_schedules.sql
-- Public home D-Day schedule list managed by admin.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS dashboard_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    target_date TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_dashboard_schedules_visible_order
    ON dashboard_schedules(is_visible, display_order, id);

INSERT INTO dashboard_schedules (title, target_date, display_order, is_visible)
SELECT 'JLPT N1', NULL, 10, 1
WHERE NOT EXISTS (SELECT 1 FROM dashboard_schedules);

INSERT INTO dashboard_schedules (title, target_date, display_order, is_visible)
SELECT 'AP', NULL, 20, 1
WHERE (SELECT COUNT(*) FROM dashboard_schedules) = 1;

INSERT INTO dashboard_schedules (title, target_date, display_order, is_visible)
SELECT 'FP', NULL, 30, 1
WHERE (SELECT COUNT(*) FROM dashboard_schedules) = 2;

INSERT INTO dashboard_schedules (title, target_date, display_order, is_visible)
SELECT 'AWS SAA', NULL, 40, 1
WHERE (SELECT COUNT(*) FROM dashboard_schedules) = 3;

INSERT INTO dashboard_schedules (title, target_date, display_order, is_visible)
SELECT 'Portfolio × 2', NULL, 50, 1
WHERE (SELECT COUNT(*) FROM dashboard_schedules) = 4;
