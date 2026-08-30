-- 0026_calendar_schedules.sql
-- 일반 일정관리: D-Day/목표 카운트다운과 분리된 월간 일정 데이터.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS calendar_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    due_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_calendar_schedules_due_date
    ON calendar_schedules(due_date, id);

CREATE INDEX IF NOT EXISTS idx_calendar_schedules_created_at
    ON calendar_schedules(created_at, id);
