-- 0027_calendar_schedule_ranges.sql
-- 일정 날짜를 없음 / 하루 / 기간으로 지원한다.

PRAGMA foreign_keys = ON;

ALTER TABLE calendar_schedules RENAME TO calendar_schedules_v1;

CREATE TABLE calendar_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK (end_date IS NULL OR start_date IS NOT NULL),
    CHECK (end_date IS NULL OR end_date >= start_date)
);

INSERT INTO calendar_schedules (id, content, start_date, end_date, created_at, updated_at)
SELECT id, content, due_date, NULL, created_at, updated_at
FROM calendar_schedules_v1;

DROP TABLE calendar_schedules_v1;

CREATE INDEX idx_calendar_schedules_start_date
    ON calendar_schedules(start_date, id);

CREATE INDEX idx_calendar_schedules_end_date
    ON calendar_schedules(end_date, id);

CREATE INDEX idx_calendar_schedules_created_at
    ON calendar_schedules(created_at, id);
